import "server-only";
import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Scan alerting — email + signed outbound webhook fan-out.
 *
 * Invoked from the agathon webhook ingress on scan.completed and
 * scan.vector.breach. Reads the owner's notification_preferences (service role
 * bypasses RLS) and dispatches best-effort: a failure here never fails the
 * scan persistence that triggered it.
 */

export interface NotifPrefs {
  email_on_scan_complete: boolean;
  email_on_breach: boolean;
  webhook_url: string | null;
  webhook_secret: string | null;
}

interface ScanAlertContext {
  scanId: string;
  ownerId: string;
  riskLabel: string;
  findingCount: number;
  highSeverityCount: number;
  aleUsd: number | null;
  executiveSummary: string | null;
  /** True for a real-time breach mid-scan (vs. a completion summary). */
  breach: boolean;
  /** Breach detail for the email body, when available. */
  breachAttack?: string | null;
}

async function loadPrefs(admin: SupabaseClient, userId: string): Promise<NotifPrefs | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("notification_preferences")
    .select("email_on_scan_complete, email_on_breach, webhook_url, webhook_secret")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as NotifPrefs;
}

async function loadOwnerEmail(admin: SupabaseClient, userId: string): Promise<{ email: string | null; name: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  return { email: (data?.email as string | null) ?? null, name: (data?.full_name as string | null) ?? null };
}

function buildAlertSubject(ctx: ScanAlertContext): string {
  if (ctx.breach) {
    return `[ForgeGuard] Breach detected · scan-${ctx.scanId.slice(0, 8)} (${ctx.riskLabel})`;
  }
  return `[ForgeGuard] Scan complete · scan-${ctx.scanId.slice(0, 8)} — ${ctx.findingCount} finding(s), ${ctx.riskLabel}`;
}

function buildAlertHtml(ctx: ScanAlertContext, name: string): string {
  const heading = ctx.breach ? "A breach was detected mid-scan." : "Your red-team scan has completed.";
  const breachLine = ctx.breachAttack
    ? `<p><strong>Vector:</strong> ${escapeHtml(ctx.breachAttack)}</p>`
    : "";
  const aleLine =
    ctx.aleUsd != null
      ? `<p><strong>Annualised loss exposure:</strong> $${ctx.aleUsd.toLocaleString()}</p>`
      : "";
  const summary =
    ctx.executiveSummary && ctx.executiveSummary.trim()
      ? `<p style="font-family:monospace;font-size:12px;color:#444;background:#f8f8f8;border-left:3px solid #ccc;padding:10px;white-space:pre-wrap">${escapeHtml(ctx.executiveSummary.slice(0, 800))}</p>`
      : "";
  return `
    <p>${escapeHtml(name)},</p>
    <p><strong>${heading}</strong></p>
    <p><strong>Scan:</strong> ${escapeHtml(ctx.scanId)}</p>
    <p><strong>Risk:</strong> ${escapeHtml(ctx.riskLabel)} · <strong>Findings:</strong> ${ctx.findingCount} (${ctx.highSeverityCount} high/critical)</p>
    ${breachLine}
    ${aleLine}
    ${summary}
    <p style="margin-top:16px"><a href="https://forgeguard.ai/dashboard/scans/${encodeURIComponent(ctx.scanId)}">Open the scan report →</a></p>
    <p style="font-family:monospace;font-size:11px;color:#888;margin-top:24px">ForgeGuard AI — alerting · manage preferences in Settings</p>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendAlertEmail(to: string, ctx: ScanAlertContext, name: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "ForgeGuard <alerts@forgeguard.ai>";
  if (!resendKey) {
    console.log(`[alert-email] DEV — ${ctx.breach ? "breach" : "scan-complete"} → ${to} (${buildAlertSubject(ctx)})`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: buildAlertSubject(ctx),
        html: buildAlertHtml(ctx, name),
      }),
    });
    if (!res.ok) console.error("[alert-email] Resend failed:", await res.text());
  } catch (err) {
    console.error("[alert-email] send error:", err);
  }
}

async function dispatchWebhook(
  url: string,
  secret: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    headers["X-ForgeGuard-Signature"] = `sha256=${sig}`;
  }
  try {
    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) console.warn("[alert-webhook] non-2xx:", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.warn("[alert-webhook] dispatch failed:", err);
  }
}

/**
 * Fan out scan-complete / breach notifications for a scan owner.
 * Best-effort — swallows all errors so it can never break scan persistence.
 */
export async function dispatchScanAlert(
  admin: SupabaseClient,
  ctx: ScanAlertContext,
): Promise<void> {
  try {
    const [prefs, owner] = await Promise.all([
      loadPrefs(admin, ctx.ownerId),
      loadOwnerEmail(admin, ctx.ownerId),
    ]);

    const wantEmail = ctx.breach
      ? prefs?.email_on_breach ?? true
      : prefs?.email_on_scan_complete ?? true;

    const webhookUrl = prefs?.webhook_url?.trim() || null;

    if (!wantEmail && !webhookUrl) return;

    const payload = {
      event: ctx.breach ? "scan.breach" : "scan.completed",
      scan_id: ctx.scanId,
      risk_label: ctx.riskLabel,
      finding_count: ctx.findingCount,
      high_severity_count: ctx.highSeverityCount,
      ale_usd: ctx.aleUsd,
      breach_attack: ctx.breachAttack ?? null,
      executive_summary: ctx.executiveSummary,
      timestamp: new Date().toISOString(),
    };

    const tasks: Promise<void>[] = [];
    if (wantEmail && owner.email) {
      tasks.push(sendAlertEmail(owner.email, ctx, owner.name ?? "Operator"));
    }
    if (webhookUrl) {
      tasks.push(dispatchWebhook(webhookUrl, prefs?.webhook_secret ?? null, payload));
    }
    await Promise.allSettled(tasks);
  } catch (err) {
    console.warn("[alert-dispatch] swallowed error:", err);
  }
}
