// =====================================================
// Edge middleware: Aegis burst limiter + rate limiting +
// sovereign /admin gate + nonce-based CSP + CORS for /api/*
// =====================================================

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSovereignOperator, maskOperatorEmail } from "@/lib/access/sovereign-operator";
import {
  getClientIp,
  isScraperRequest,
  logBlacklistedEntity,
} from "@/services/scraper-defense.service";
import {
  enforceAgathonWebhookGate,
  fortressBlockedResponse,
  isSessionFortressBlocked,
} from "@/services/fortress-perimeter.service";
import {
  BUNKER_CHALLENGE_PATH,
  honeypotRedirectUrl,
  isHoneypotPath,
} from "@/services/honeypot-defense.service";
import {
  mintPowChallenge,
  parsePowHeader,
  powChallengeResponseBody,
  powHeaderName,
  POW_VOLUME_THRESHOLD,
  verifyPowSolution,
} from "@/services/pow-challenge.service";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const powVolumeStore = new Map<string, RateLimitEntry>();

const AEGIS_BURST = { max: 10, windowMs: 1000 } as const;

const RATE_LIMITS = {
  authWrite: { max: 10, windowMs: 15 * 60 * 1000 },
  authRead: { max: 60, windowMs: 60 * 1000 },
  scan: { max: 20, windowMs: 15 * 60 * 1000 },
  api: { max: 20, windowMs: 10 * 1000 },
  general: { max: 1000, windowMs: 60 * 1000 },
} as const;

const KNOWN_DASHBOARD_PREFIXES = [
  "/dashboard/analytics",
  "/dashboard/aegis",
  "/dashboard/aegis-shield",
  "/dashboard/bunker",
  "/dashboard/bazaar",
  "/dashboard/bounties",
  "/dashboard/billing",
  "/dashboard/forge",
  "/dashboard/intel",
  "/dashboard/missions",
  "/dashboard/recon",
  "/dashboard/repos",
  "/dashboard/scans",
  "/dashboard/scheduled",
  "/dashboard/settings",
] as const;

function isKnownDashboardRoute(pathname: string): boolean {
  if (pathname === "/dashboard") return true;
  return KNOWN_DASHBOARD_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Static/metadata assets — skip middleware (favicon, icons, SEO). */
function isStaticAssetPath(pathname: string): boolean {
  if (
    pathname === "/favicon.ico" ||
    pathname === "/opengraph-image" ||
    pathname === "/twitter-image" ||
    pathname === "/icon" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon" ||
    pathname === "/apple-icon.png" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/apple-touch-icon-precomposed.png" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.json" ||
    pathname === "/site.webmanifest"
  ) {
    return true;
  }
  if (
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/fonts/")
  ) {
    return true;
  }
  return /\.(svg|png|ico|webp|jpg|jpeg|gif|woff2?|xml|txt|webmanifest)$/i.test(
    pathname,
  );
}

function getClientKey(request: NextRequest, bucket: string): string {
  return `${getClientIp(request)}:${bucket}`;
}

function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count += 1;
  return false;
}

function logAttackAttempt(
  request: NextRequest,
  reason: string,
  bucket?: string,
): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const ip = getClientIp(request);
  const payload = {
    ip_address: ip,
    path: request.nextUrl.pathname,
    method: request.method,
    user_agent: request.headers.get("user-agent"),
    reason,
    metadata: { bucket: bucket ?? reason },
  };

  void fetch(`${url}/rest/v1/attack_logs`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* fire-and-forget — never block redirects/429 */
  });
}

function rateLimitResponse(
  request: NextRequest,
  max: number,
  windowMs: number,
  reason: string,
  bucket: string,
): NextResponse {
  if (
    reason === "rate_limit_burst" ||
    reason === "rate_limit_api" ||
    reason === "sovereign_violation"
  ) {
    logAttackAttempt(request, reason, bucket);
  }

  const retryAfter = Math.ceil(windowMs / 1000);
  const isServerAction = request.headers.has("next-action");
  return new NextResponse(
    isServerAction
      ? null
      : JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
        ...(isServerAction ? {} : { "Content-Type": "application/json" }),
        "X-RateLimit-Limit": max.toString(),
        "X-RateLimit-Window": retryAfter.toString(),
        "X-Aegis-Block": reason,
      },
    },
  );
}

function getRateLimitConfig(
  pathname: string,
  method: string,
): { bucket: string; max: number; windowMs: number; reason: string } {
  const isWrite = method !== "GET" && method !== "HEAD";

  if (pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/")) {
    return isWrite
      ? { bucket: "authWrite", reason: "rate_limit", ...RATE_LIMITS.authWrite }
      : { bucket: "authRead", reason: "rate_limit", ...RATE_LIMITS.authRead };
  }
  if (
    pathname.startsWith("/api/chat") ||
    pathname.startsWith("/api/submissions") ||
    pathname.startsWith("/api/contact") ||
    pathname.startsWith("/api/scan") ||
    pathname.startsWith("/api/forge") ||
    pathname.startsWith("/api/bounty") ||
    pathname.startsWith("/api/aegis")
  ) {
    return { bucket: "scan", reason: "rate_limit", ...RATE_LIMITS.scan };
  }
  if (pathname.startsWith("/api/")) {
    return { bucket: "api", reason: "rate_limit_api", ...RATE_LIMITS.api };
  }
  return { bucket: "general", reason: "rate_limit", ...RATE_LIMITS.general };
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function buildCsp(nonce: string, isDev: boolean): string {
  const scriptParts = [
    `'nonce-${nonce}'`,
    `'strict-dynamic'`,
    `'self'`,
    isDev ? `'unsafe-eval'` : null,
    isDev ? `'unsafe-inline'` : null,
    `https:`,
  ].filter(Boolean);

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptParts.join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com https://openrouter.ai`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ];

  if (!isDev) {
    directives.push(`upgrade-insecure-requests`);
  }

  return directives.join("; ");
}

function defaultAllowedOrigin(isDev: boolean): string {
  if (process.env.ALLOWED_ORIGINS) return process.env.ALLOWED_ORIGINS;
  return isDev ? "http://localhost:3000" : "https://www.forgeguard-ai.com";
}

async function enforceAdminSovereignGate(
  request: NextRequest,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return null;
  if (pathname.startsWith("/auth/force-logout")) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    logAttackAttempt(request, "sovereign_violation", "adminGate");
    return NextResponse.redirect(new URL("/auth/force-logout", request.url));
  }

  let response = NextResponse.next();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next();
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isSovereignOperator(user?.email)) {
    logAttackAttempt(request, "sovereign_violation", "adminGate");
    return NextResponse.redirect(new URL("/auth/force-logout", request.url));
  }

  console.info(
    `[Aegis] Sovereign Guard Active for Operator: ${maskOperatorEmail(user!.email!)}`,
  );

  return null;
}

/**
 * Sovereign operators skip scraper PoW, rate limits, and fortress blocks.
 * v1 REST routes skip PoW — they authenticate via fg_ Bearer keys (CI/curl safe).
 */
async function isSovereignRequest(request: NextRequest): Promise<boolean> {
  if (await isSovereignSession(request)) return true;
  if (request.nextUrl.pathname.startsWith("/api/v1/")) return true;
  return false;
}

async function isSovereignSession(request: NextRequest): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isSovereignOperator(user?.email);
}

/**
 * Kinetic honeypots — synchronous, no session auth. Rewrites to bunker PoW.
 */
function enforceKineticHoneypot(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith(BUNKER_CHALLENGE_PATH)) return null;
  if (pathname.startsWith("/api/bunker/")) return null;
  if (!isHoneypotPath(pathname)) return null;

  logBlacklistedEntity(request, `kinetic_honeypot:${pathname}`);
  logAttackAttempt(request, "kinetic_honeypot", pathname);

  const rewriteUrl = honeypotRedirectUrl(request, pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", BUNKER_CHALLENGE_PATH);

  const response = NextResponse.rewrite(rewriteUrl, {
    request: { headers: requestHeaders },
  });
  response.headers.set("X-Aegis-Honeypot", "trapped");
  return response;
}

/**
 * High-volume scrapers must solve SHA-256 PoW before receiving responses.
 */
async function enforcePowChallenge(
  request: NextRequest,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // Liveness + launch audit — never gate behind PoW (monitoring must reach engine status).
  if (
    pathname === "/api/health" ||
    pathname === "/api/health/engine"
  ) {
    return null;
  }

  if (pathname.startsWith("/_next/")) return null;
  if (pathname.startsWith("/api/v1/webhooks/")) return null;

  const ip = getClientIp(request);
  const volumeKey = `${ip}:powVolume`;
  const now = Date.now();
  const windowMs = 60_000;
  const volEntry = powVolumeStore.get(volumeKey);
  let count = 1;
  if (volEntry && now <= volEntry.resetTime) {
    volEntry.count += 1;
    count = volEntry.count;
  } else {
    powVolumeStore.set(volumeKey, { count: 1, resetTime: now + windowMs });
  }

  const suspicious = isScraperRequest(request);
  const highVolume = count >= POW_VOLUME_THRESHOLD;
  if (!suspicious && !highVolume) return null;
  if (await isSovereignRequest(request)) return null;

  const challengeCookie = request.cookies.get("aegis-pow-challenge")?.value;
  const difficulty = Number.parseInt(
    request.cookies.get("aegis-pow-difficulty")?.value ?? "4",
    10,
  );
  const powRaw = request.headers.get(powHeaderName());
  const parsed = parsePowHeader(powRaw);

  if (challengeCookie && parsed) {
    const ok = await verifyPowSolution(
      challengeCookie,
      parsed.nonce,
      parsed.hash,
      Number.isNaN(difficulty) ? 4 : difficulty,
    );
    if (ok) return null;
  }

  logBlacklistedEntity(request, highVolume ? "pow_volume_violation" : "pow_scraper_violation");
  const issued = mintPowChallenge(ip);
  const res = NextResponse.json(powChallengeResponseBody(issued), {
    status: 429,
    headers: {
      "Cache-Control": "no-store",
      "X-Aegis-PoW": "required",
    },
  });
  res.cookies.set("aegis-pow-challenge", issued.challenge, {
    httpOnly: true,
    maxAge: 3600,
    sameSite: "lax",
    path: "/",
  });
  res.cookies.set("aegis-pow-difficulty", String(issued.difficulty), {
    httpOnly: true,
    maxAge: 3600,
    sameSite: "lax",
    path: "/",
  });
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAssetPath(pathname)) {
    return NextResponse.next();
  }

  const honeypotBlock = enforceKineticHoneypot(request);
  if (honeypotBlock) return honeypotBlock;

  if (isSessionFortressBlocked(request)) {
    if (!(await isSovereignRequest(request))) {
      return fortressBlockedResponse();
    }
  }

  const webhookBlock = enforceAgathonWebhookGate(request);
  if (webhookBlock) return webhookBlock;

  const powBlock = await enforcePowChallenge(request);
  if (powBlock) return powBlock;

  if (pathname.startsWith("/dashboard/") && !isKnownDashboardRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const sovereignBlock = await enforceAdminSovereignGate(request);
  if (sovereignBlock) return sovereignBlock;

  const sovereignBypass = await isSovereignRequest(request);

  if (!sovereignBypass && !isStaticAssetPath(pathname)) {
    const burstKey = getClientKey(request, "aegisBurst");
    if (isRateLimited(burstKey, AEGIS_BURST.max, AEGIS_BURST.windowMs)) {
      return rateLimitResponse(
        request,
        AEGIS_BURST.max,
        AEGIS_BURST.windowMs,
        "rate_limit_burst",
        "aegisBurst",
      );
    }

    const cfg = getRateLimitConfig(pathname, request.method);
    const key = getClientKey(request, cfg.bucket);
    if (isRateLimited(key, cfg.max, cfg.windowMs)) {
      return rateLimitResponse(
        request,
        cfg.max,
        cfg.windowMs,
        cfg.reason,
        cfg.bucket,
      );
    }
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    const limit = pathname.startsWith("/api/") ? 1024 * 1024 : 10 * 1024 * 1024;
    if (size > limit) {
      return new NextResponse(
        JSON.stringify({ error: "Request payload exceeds maximum size" }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildCsp(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  if (pathname.startsWith("/api/")) {
    const allowedOrigin = defaultAllowedOrigin(isDev);
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-aegis-pow, x-internal-scan-token",
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|icons/).*)",
    "/.env",
    "/.env.local",
    "/wp-admin",
    "/wp-admin/:path*",
    "/admin/setup",
    "/admin/setup/:path*",
  ],
};
