import { NextResponse } from "next/server";
import {
  buildEngineHealthUrl,
  engineAuthHeaders,
  resolveEngineBaseUrl,
  resolveEngineAuthToken,
} from "@/lib/agathon-config";
import {
  getStripeBillingPortalUrl,
  getStripeHostedCheckoutUrl,
  isStripeCheckoutConfigured,
} from "@/lib/payments/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const DEBUG_LOG =
  "http://127.0.0.1:7434/ingest/9739fdfe-4a94-4d0e-8d13-8449868d349d";

function debugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) {
  // #region agent log
  fetch(DEBUG_LOG, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "c20499",
    },
    body: JSON.stringify({
      sessionId: "c20499",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
      runId: "launch-check",
    }),
  }).catch(() => {});
  // #endregion
}

/** GET /api/debug/launch-check — pre-launch system audit (PoW-exempt). */
export async function GET() {
  const checks: Record<string, unknown> = {};

  const stripeStartup = getStripeHostedCheckoutUrl("startup");
  const stripeSovereign = getStripeHostedCheckoutUrl("enterprise");
  const stripePortal = getStripeBillingPortalUrl();
  checks.stripe = {
    configured: isStripeCheckoutConfigured(),
    startup: Boolean(stripeStartup),
    sovereign: Boolean(stripeSovereign),
    portal: Boolean(stripePortal),
  };
  debugLog("H2", "launch-check:stripe", "Stripe env resolution", checks.stripe as Record<string, unknown>);

  const engineUrl = resolveEngineBaseUrl();
  const engineToken = resolveEngineAuthToken();
  checks.engineEnv = {
    urlSet: Boolean(engineUrl),
    tokenSet: Boolean(engineToken),
  };
  debugLog("H1", "launch-check:engineEnv", "Engine env", checks.engineEnv as Record<string, unknown>);

  let engineProbe: Record<string, unknown> = { skipped: true };
  if (engineUrl && engineToken) {
    const auth = engineAuthHeaders();
    const healthUrl = buildEngineHealthUrl(engineUrl);
    const t0 = Date.now();
    try {
      const resp = await fetch(healthUrl, {
        method: "GET",
        headers: { ...auth!, "Cache-Control": "no-store" },
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      });
      engineProbe = {
        ok: resp.ok,
        httpStatus: resp.status,
        latencyMs: Date.now() - t0,
        url: healthUrl.replace(/\/\/[^@]+@/, "//***@"),
      };
    } catch (err) {
      engineProbe = {
        ok: false,
        latencyMs: Date.now() - t0,
        error: err instanceof Error ? err.message : "probe failed",
      };
    }
  }
  checks.engineProbe = engineProbe;
  debugLog("H1", "launch-check:engineProbe", "Direct engine probe", engineProbe);

  checks.supabase = {
    urlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKeySet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleSet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    openRouterSet: Boolean(process.env.OPENROUTER_API_KEY),
  };
  debugLog("H3", "launch-check:supabase", "Supabase/compliance env", checks.supabase as Record<string, unknown>);

  const allGreen =
    (checks.stripe as { configured: boolean }).configured &&
    (checks.engineProbe as { ok?: boolean }).ok !== false &&
    (checks.supabase as { urlSet: boolean }).urlSet;

  checks.summary = allGreen ? "READY" : "GAPS_DETECTED";
  debugLog("H0", "launch-check:summary", "Launch check complete", { summary: checks.summary });

  return NextResponse.json({ ok: allGreen, checks, ts: new Date().toISOString() });
}
