/**
 * notify-scan-sealed — Supabase Edge Function
 * --------------------------------------------
 * Triggered by a Supabase Database Webhook on the `scans` table
 * whenever a row is updated. When the new status is "sealed" and
 * the old status was not, we:
 *   1. Fetch the user's email from auth.users
 *   2. Fetch the scan_reports summary
 *   3. Send a formatted email via Resend
 *
 * Setup (Supabase Dashboard):
 *   Database → Webhooks → Create webhook
 *     Table:  scans
 *     Events: UPDATE
 *     URL:    https://<project>.supabase.co/functions/v1/notify-scan-sealed
 *     HTTP headers: Authorization: Bearer <service_role_key>
 *
 * Required secrets (supabase secrets set):
 *   RESEND_API_KEY   — from resend.com
 *   APP_URL          — e.g. https://forgeguard.ai
 *   FROM_EMAIL       — e.g. alerts@forgeguard.ai
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

interface Finding {
  severity: "critical" | "high" | "medium" | "low" | "info";
}

serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const { record, old_record } = payload;

  // Only fire when status transitions TO "sealed"
  if (
    record.status !== "sealed" ||
    (old_record && old_record.status === "sealed")
  ) {
    return new Response("skip", { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const appUrl = Deno.env.get("APP_URL") ?? "https://forgeguard.ai";
  const fromEmail = Deno.env.get("FROM_EMAIL") ?? "alerts@forgeguard.ai";

  if (!resendKey) {
    console.warn("[notify-scan-sealed] RESEND_API_KEY not set — skipping email");
    return new Response("no resend key", { status: 200 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Get user email
  const userId = record.user_id as string;
  const { data: userData, error: userErr } =
    await admin.auth.admin.getUserById(userId);
  if (userErr || !userData?.user?.email) {
    console.error("[notify-scan-sealed] user lookup failed:", userErr?.message);
    return new Response("user not found", { status: 200 });
  }
  const email = userData.user.email;

  // 2. Get scan report summary
  const scanId = record.id as string;
  const { data: report } = await admin
    .from("scan_reports")
    .select("cvss_overall, risk_label, findings, attacks_run, wall_seconds")
    .eq("scan_id", scanId)
    .maybeSingle();

  const cvss = (report?.cvss_overall as number | null)?.toFixed(1) ?? "0.0";
  const riskLabel = (report?.risk_label as string | null) ?? "NONE";
  const findings: Finding[] = (report?.findings as Finding[] | null) ?? [];
  const findingCount = findings.length;
  const critCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const wallMin = report?.wall_seconds
    ? Math.round((report.wall_seconds as number) / 60)
    : null;

  const RISK_COLOR: Record<string, string> = {
    CRITICAL: "#dc2626",
    HIGH: "#f97316",
    MEDIUM: "#d97706",
    LOW: "#84cc16",
    NONE: "#6b7280",
  };
  const riskCol = RISK_COLOR[riskLabel] ?? RISK_COLOR.NONE;

  const summaryBadge =
    critCount > 0
      ? `<span style="color:#dc2626;font-size:11px">${critCount} CRITICAL</span>`
      : highCount > 0
        ? `<span style="color:#f97316;font-size:11px">${highCount} HIGH</span>`
        : `<span style="color:#84cc16;font-size:11px">No high-severity issues</span>`;

  // 3. Send email via Resend
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#fff">
      <!-- Header -->
      <div style="background:#050505;padding:20px 24px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:16px;font-weight:700;color:#D1FF00;letter-spacing:-.01em">ForgeGuard AI</div>
          <div style="font-size:11px;color:#666;margin-top:2px">Red Team Intelligence</div>
        </div>
        <div style="font-family:monospace;font-size:10px;color:#444">${scanId.slice(0, 8)}</div>
      </div>
      <!-- Body -->
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-bottom:none">
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Your scan has completed and the intelligence report is ready.</p>
        <!-- CVSS card -->
        <div style="display:flex;gap:12px;margin-bottom:20px">
          <div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px;text-align:center">
            <div style="font-family:monospace;font-size:32px;font-weight:700;color:${riskCol};line-height:1">${cvss}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${riskCol};margin-top:2px">${riskLabel} RISK</div>
          </div>
          <div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px;text-align:center">
            <div style="font-size:32px;font-weight:700;color:#111;line-height:1">${findingCount}</div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-top:2px">Total Findings</div>
            <div style="margin-top:4px">${summaryBadge}</div>
          </div>
        </div>
        <!-- Details -->
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:7px 0;color:#6b7280">Target</td>
            <td style="padding:7px 0;font-family:monospace;color:#374151;text-align:right;word-break:break-all">${String(record.target_model ?? "")}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:7px 0;color:#6b7280">Endpoint</td>
            <td style="padding:7px 0;font-family:monospace;font-size:11px;color:#374151;text-align:right;word-break:break-all">${String(record.target_url ?? "")}</td>
          </tr>
          ${wallMin ? `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:7px 0;color:#6b7280">Duration</td><td style="padding:7px 0;color:#374151;text-align:right">${wallMin}m</td></tr>` : ""}
        </table>
        <!-- CTA -->
        <a href="${appUrl}/dashboard/scans/${scanId}"
           style="display:block;text-align:center;background:#D1FF00;color:#050505;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:.01em">
          View Full Report &amp; Download PDF →
        </a>
      </div>
      <!-- Footer -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:12px 24px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;color:#9ca3af">ForgeGuard AI</span>
        <a href="${appUrl}/dashboard/settings" style="font-size:11px;color:#9ca3af;text-decoration:none">Manage notifications</a>
      </div>
    </div>
  `;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `ForgeGuard AI <${fromEmail}>`,
      to: email,
      subject: `[ForgeGuard] Scan complete — ${riskLabel} risk · CVSS ${cvss}`,
      html,
    }),
  });

  if (!resendRes.ok) {
    const body = await resendRes.text();
    console.error("[notify-scan-sealed] Resend error:", resendRes.status, body);
    return new Response("resend error", { status: 500 });
  }

  console.log(`[notify-scan-sealed] email sent to ${email} for scan ${scanId}`);
  return new Response("sent", { status: 200 });
});
