/**
 * Fortress perimeter — session IP blocks and webhook token gate.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveEngineAuthToken } from "@/lib/agathon-config";
import { getClientIp, logBlacklistedEntity } from "@/services/scraper-defense.service";

export const FORTRESS_BLOCK_COOKIE = "aegis-fortress-block";
export const BUNKER_CLEARED_COOKIE = "aegis-bunker-cleared";
export const WEBHOOK_PATH = "/api/v1/webhooks/agathon";
export const INTERNAL_SCAN_TOKEN_HEADER = "x-internal-scan-token";

export function isSessionFortressBlocked(request: NextRequest): boolean {
  return request.cookies.get(FORTRESS_BLOCK_COOKIE)?.value === "1";
}

export function applyFortressBlock(response: NextResponse): void {
  response.cookies.set(FORTRESS_BLOCK_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function fortressBlockedResponse(): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: "Fortress perimeter: access permanently revoked for this session." }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        "X-Aegis-Fortress": "blocked",
      },
    },
  );
}

/**
 * Agathon webhook — POST only, requires x-internal-scan-token.
 * Returns a response when the request must be rejected; null when allowed through.
 */
export function enforceAgathonWebhookGate(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname !== WEBHOOK_PATH) return null;

  if (request.method !== "POST") {
    logBlacklistedEntity(request, "webhook_method_violation");
    const res = NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    applyFortressBlock(res);
    return res;
  }

  const expected = resolveEngineAuthToken();
  const provided = request.headers.get(INTERNAL_SCAN_TOKEN_HEADER)?.trim();

  if (!expected || !provided || provided !== expected) {
    logBlacklistedEntity(request, "webhook_token_violation");
    logAttackLogCritical(request, "webhook_unauthorized");
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    applyFortressBlock(res);
    return res;
  }

  return null;
}

function logAttackLogCritical(request: NextRequest, reason: string): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  void fetch(`${url}/rest/v1/attack_logs`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ip_address: getClientIp(request),
      path: request.nextUrl.pathname,
      method: request.method,
      user_agent: request.headers.get("user-agent"),
      reason,
      metadata: { severity: "CRITICAL", defense: "fortress_webhook" },
    }),
  }).catch(() => {
    /* fire-and-forget */
  });
}
