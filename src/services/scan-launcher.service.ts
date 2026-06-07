import "server-only";

import {
  resolveEngineAuthToken,
  resolveEngineBaseUrl,
} from "@/lib/agathon-config";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getEngineHealthSnapshot,
  isEngineLockdown,
} from "@/lib/engine/probe-engine-health";
import { runScan } from "@/lib/runner/runner";

export type LaunchScanContext = {
  scanId: string;
  userId: string;
  /** Optional — resolved from profiles when omitted. */
  userEmail?: string | null;
};

export type LaunchScanResult =
  | { ok: true; scanId: string; message: string; alreadyRunning?: boolean }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
      plan?: string;
    };

type ScanRow = { id: string; user_id: string; status: string; intensity: string | null };

type QuotaRow = {
  plan: string;
  status: string;
  scans_used_this_period: number;
  period_ends_at: string | null;
};

const SCANS_ALLOWED: Record<string, number> = {
  free: 2,
  startup: 20,
  enterprise: 999_999,
};

function scansAllowedForPlan(plan: string): number {
  return SCANS_ALLOWED[plan] ?? 2;
}

function periodExpired(periodEndsAt: string | null): boolean {
  if (!periodEndsAt) return false;
  return Date.now() > new Date(periodEndsAt).getTime();
}

async function resolveUserEmail(
  userId: string,
  provided?: string | null,
): Promise<string | null> {
  if (provided) return provided;
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

async function enforceScanQuota(userId: string, userEmail: string | null): Promise<LaunchScanResult | null> {
  if (isSovereignOperator(userEmail)) return null;

  const admin = createAdminSupabase();
  const { data: quota } = (await admin
    .from("subscriptions")
    .select("plan, status, scans_used_this_period, period_ends_at")
    .eq("user_id", userId)
    .maybeSingle()) as { data: QuotaRow | null };

  if (!quota) return null;

  const isActive =
    quota.status === "active" ||
    quota.status === "trialing" ||
    quota.status === "on_trial";
  const periodOk = !periodExpired(quota.period_ends_at);
  const allowed = scansAllowedForPlan(quota.plan);
  const underLimit =
    allowed >= 999_999 || quota.scans_used_this_period < allowed;

  if (isActive && periodOk && underLimit) {
    await admin
      .from("subscriptions")
      .update({ scans_used_this_period: quota.scans_used_this_period + 1 })
      .eq("user_id", userId);
    return null;
  }

  const reason = !isActive
    ? `Subscription is ${quota.status}. Renew your plan to run more scans.`
    : !periodOk
      ? "Your billing period has expired. Please renew to continue scanning."
      : `Scan limit reached (${quota.scans_used_this_period}/${allowed} this period). Upgrade for more.`;

  return {
    ok: false,
    status: 402,
    error: reason,
    code: "QUOTA_EXCEEDED",
    plan: quota.plan,
  };
}

/**
 * Shared scan dispatch — used by session cookie routes and Enterprise v1 API.
 * Does not rely on Supabase session cookies.
 */
export async function launchScan(ctx: LaunchScanContext): Promise<LaunchScanResult> {
  const admin = createAdminSupabase();

  const { data: scan, error: fetchErr } = (await admin
    .from("scans")
    .select("id, user_id, status, intensity")
    .eq("id", ctx.scanId)
    .maybeSingle()) as { data: ScanRow | null; error: { message: string } | null };

  if (fetchErr) {
    console.error("[scan-launcher] fetch:", fetchErr.message);
    return { ok: false, status: 500, error: "Lookup failed" };
  }
  if (!scan) {
    return { ok: false, status: 404, error: "Scan not found" };
  }
  if (scan.user_id !== ctx.userId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  if (scan.status === "probing" || scan.status === "triage") {
    return {
      ok: true,
      scanId: scan.id,
      message: "Scan already running",
      alreadyRunning: true,
    };
  }

  const userEmail = await resolveUserEmail(ctx.userId, ctx.userEmail);
  const quotaBlock = await enforceScanQuota(ctx.userId, userEmail);
  if (quotaBlock) return quotaBlock;

  const health = await getEngineHealthSnapshot();
  if (isEngineLockdown(health)) {
    return {
      ok: false,
      status: 503,
      error: health.reason ?? "Engine bunker unreachable",
      code: "ENGINE_LOCKDOWN",
    };
  }

  const engineUrl = resolveEngineBaseUrl();
  const engineToken = resolveEngineAuthToken();
  if (!engineUrl) {
    console.error(
      "[scan-launcher] Missing engine URL: set PYTHON_ENGINE_URL or AGATHON_ORCHESTRATOR_URL on Vercel",
    );
  }
  if (!engineToken) {
    console.error(
      "[scan-launcher] Missing auth token: set INTERNAL_SCAN_TOKEN or AGATHON_INTERNAL_SECRET on Vercel",
    );
  }

  try {
    const highIntensity =
      scan.intensity === "greasy" || scan.intensity === "aggressive";
    if (highIntensity) {
      void runScan({ scanId: scan.id, userId: ctx.userId }).catch((err) => {
        console.error("[scan-launcher] async runScan failed:", err);
      });
      return {
        ok: true,
        scanId: scan.id,
        message: "Runner dispatched (non-blocking high-intensity)",
      };
    }
    await runScan({ scanId: scan.id, userId: ctx.userId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[scan-launcher] runScan rejected:", {
      scan_id: scan.id,
      engineUrl: engineUrl ?? "<unset>",
      hasToken: Boolean(engineToken),
      message,
      stack,
      err,
    });
    return {
      ok: false,
      status: 500,
      error: `Runner kickoff failed: ${message || "unknown"}`,
    };
  }

  return {
    ok: true,
    scanId: scan.id,
    message: "Runner dispatched",
  };
}
