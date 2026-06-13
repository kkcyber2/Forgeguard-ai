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
import { getPlanMeta, type PlanId } from "@/lib/plans";
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

/** Wallet debit per scan when subscription quota is exhausted (USD). */
function scanOverageDebitUsd(): number {
  const raw = process.env.SCAN_OVERAGE_WALLET_DEBIT_USD?.trim();
  const parsed = raw ? Number(raw) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

type ScanPayment =
  | { mode: "none" }
  | { mode: "quota"; userId: string }
  | { mode: "wallet"; userId: string; debitUsd: number };

function scansAllowedForPlan(plan: string): number {
  const id = (["free", "startup", "enterprise"].includes(plan)
    ? plan
    : "free") as PlanId;
  return getPlanMeta(id).scansPerMonth;
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

async function resolveScanPayment(
  userId: string,
  userEmail: string | null,
): Promise<LaunchScanResult | ScanPayment> {
  if (isSovereignOperator(userEmail)) return { mode: "none" };

  const admin = createAdminSupabase();
  const { data: quota } = (await admin
    .from("subscriptions")
    .select("plan, status, scans_used_this_period, period_ends_at")
    .eq("user_id", userId)
    .maybeSingle()) as { data: QuotaRow | null };

  if (!quota) return { mode: "none" };

  if (quota.plan === "enterprise") return { mode: "none" };

  const isActive =
    quota.status === "active" ||
    quota.status === "trialing" ||
    quota.status === "on_trial";
  const periodOk = !periodExpired(quota.period_ends_at);
  const allowed = scansAllowedForPlan(quota.plan);
  const underLimit =
    allowed >= 999_999 || quota.scans_used_this_period < allowed;

  if (isActive && periodOk && underLimit) {
    return { mode: "quota", userId };
  }

  if (!isActive || !periodOk) {
    const reason = !isActive
      ? `Subscription is ${quota.status}. Renew your plan to run more scans.`
      : "Your billing period has expired. Please renew to continue scanning.";
    return {
      ok: false,
      status: 402,
      error: reason,
      code: "QUOTA_EXCEEDED",
      plan: quota.plan,
    };
  }

  const debitUsd = scanOverageDebitUsd();
  const { data: wallet } = await admin
    .from("user_wallets")
    .select("balance_usd, is_frozen")
    .eq("user_id", userId)
    .maybeSingle();

  if (wallet?.is_frozen) {
    return {
      ok: false,
      status: 402,
      error: "Wallet frozen — contact support to restore scan access.",
      code: "WALLET_FROZEN",
      plan: quota.plan,
    };
  }

  const balance = Number(wallet?.balance_usd ?? 0);
  if (balance >= debitUsd) {
    return { mode: "wallet", userId, debitUsd };
  }

  return {
    ok: false,
    status: 402,
    error: `Scan limit reached (${quota.scans_used_this_period}/${allowed}). Buy Bazaar credits ($${debitUsd}/scan overage) or upgrade your plan.`,
    code: "QUOTA_EXCEEDED",
    plan: quota.plan,
  };
}

async function commitScanPayment(payment: ScanPayment): Promise<void> {
  if (payment.mode === "none") return;

  const admin = createAdminSupabase();

  if (payment.mode === "quota") {
    const { data: quota } = (await admin
      .from("subscriptions")
      .select("scans_used_this_period")
      .eq("user_id", payment.userId)
      .maybeSingle()) as { data: { scans_used_this_period: number } | null };

    if (!quota) return;

    await admin
      .from("subscriptions")
      .update({ scans_used_this_period: quota.scans_used_this_period + 1 })
      .eq("user_id", payment.userId);
    return;
  }

  const { error } = await admin.rpc("increment_wallet", {
    p_user_id: payment.userId,
    p_amount: -payment.debitUsd,
  });

  if (error) {
    console.error("[scan-launcher] wallet overage debit failed:", error.message);
    throw new Error(`Wallet debit failed: ${error.message}`);
  }
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
  const paymentOrBlock = await resolveScanPayment(ctx.userId, userEmail);
  if ("ok" in paymentOrBlock && !paymentOrBlock.ok) {
    return paymentOrBlock;
  }
  const payment = paymentOrBlock as ScanPayment;

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
      void runScan({ scanId: scan.id, userId: ctx.userId })
        .then(() => commitScanPayment(payment))
        .catch((err) => {
          console.error("[scan-launcher] async runScan failed:", err);
        });
      return {
        ok: true,
        scanId: scan.id,
        message: "Runner dispatched (non-blocking high-intensity)",
      };
    }
    await runScan({ scanId: scan.id, userId: ctx.userId });
    await commitScanPayment(payment);
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
