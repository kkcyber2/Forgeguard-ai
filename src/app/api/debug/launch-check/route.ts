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

  const env = (name: string) => Boolean(process.env[name]?.trim());

  checks.envMatrix = {
    required: {
      NEXT_PUBLIC_SUPABASE_URL: env("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: env("SUPABASE_SERVICE_ROLE_KEY"),
      NEXT_PUBLIC_APP_URL: env("NEXT_PUBLIC_APP_URL"),
      PYTHON_ENGINE_URL: env("PYTHON_ENGINE_URL"),
      INTERNAL_SCAN_TOKEN: env("INTERNAL_SCAN_TOKEN"),
      WAR_MACHINE_URL: env("WAR_MACHINE_URL"),
      NOWPAYMENTS_API_KEY: env("NOWPAYMENTS_API_KEY"),
      NOWPAYMENTS_IPN_SECRET: env("NOWPAYMENTS_IPN_SECRET"),
      OPENROUTER_API_KEY: env("OPENROUTER_API_KEY"),
      SCAN_CREDENTIAL_SECRET: env("SCAN_CREDENTIAL_SECRET"),
      ALLOWED_ORIGINS: env("ALLOWED_ORIGINS"),
      SOVEREIGN_OPERATOR_EMAIL: env("SOVEREIGN_OPERATOR_EMAIL"),
    },
    optional: {
      SOVEREIGN_CRYPTO_WALLET: env("SOVEREIGN_CRYPTO_WALLET"),
      UPSTASH_REDIS_REST_URL: env("UPSTASH_REDIS_REST_URL"),
      UPSTASH_REDIS_REST_TOKEN: env("UPSTASH_REDIS_REST_TOKEN"),
      TWILIO_ACCOUNT_SID: env("TWILIO_ACCOUNT_SID"),
      TWILIO_AUTH_TOKEN: env("TWILIO_AUTH_TOKEN"),
      TWILIO_PHONE_NUMBER: env("TWILIO_PHONE_NUMBER"),
      TWILIO_SIMULATION_MODE: env("TWILIO_SIMULATION_MODE"),
      GROQ_API_KEY: env("GROQ_API_KEY"),
      REVENUE_SIMULATION_MODE: env("REVENUE_SIMULATION_MODE"),
    },
  };

  const requiredEnv = checks.envMatrix as {
    required: Record<string, boolean>;
  };
  checks.envMatrixComplete = Object.values(requiredEnv.required).every(Boolean);

  const allGreen =
    (checks.crypto as { configured: boolean }).configured &&
    (checks.engineProbe as { ok?: boolean }).ok !== false &&
    (checks.supabase as { urlSet: boolean }).urlSet &&
    checks.envMatrixComplete === true;

  return NextResponse.json({ ok: allGreen, checks, ts: new Date().toISOString() });
}
