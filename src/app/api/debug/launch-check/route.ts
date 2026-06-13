import { NextResponse } from "next/server";
import {
  buildEngineHealthUrl,
  engineAuthHeaders,
  resolveEngineBaseUrl,
  resolveEngineAuthToken,
} from "@/lib/agathon-config";
import { isCryptoCheckoutConfigured } from "@/lib/payments/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/debug/launch-check — production smoke probe (no Stripe, no debug ingest).
 */
export async function GET() {
  const checks: Record<string, unknown> = {};

  checks.crypto = {
    configured: isCryptoCheckoutConfigured(),
    nowpayments: Boolean(process.env.NOWPAYMENTS_API_KEY?.trim()),
    ipnSecret: Boolean(process.env.NOWPAYMENTS_IPN_SECRET?.trim()),
    sovereignWallet: Boolean(process.env.SOVEREIGN_CRYPTO_WALLET?.trim()),
  };

  const engineUrl = resolveEngineBaseUrl();
  const engineToken = resolveEngineAuthToken();
  checks.engineEnv = { urlSet: Boolean(engineUrl), tokenSet: Boolean(engineToken) };

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

  checks.supabase = {
    urlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKeySet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleSet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  checks.openrouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  checks.warMachine = Boolean(process.env.WAR_MACHINE_URL?.trim());

  const allGreen =
    (checks.crypto as { configured: boolean }).configured &&
    (checks.engineProbe as { ok?: boolean }).ok !== false &&
    (checks.supabase as { urlSet: boolean }).urlSet;

  return NextResponse.json({ ok: allGreen, checks, ts: new Date().toISOString() });
}
