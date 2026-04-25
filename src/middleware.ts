// =====================================================
// Edge middleware: rate limiting + nonce-based CSP +
// CORS for /api/*. Nonce model lets Next.js hydrate
// without permanently allowing inline scripts.
// =====================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate-limit budgets.
 *   - authWrite: only POST/PUT to auth endpoints (actual login/signup attempts)
 *   - authRead:  GETs to /auth/* pages (visiting the login page)
 *   - api, general: everything else
 * The split fixes a class of bugs where Server Action POSTs and page GETs
 * shared a single budget, causing 429s mid-login that read as "unexpected
 * response" in useActionState.
 */
const RATE_LIMITS = {
  authWrite: { max: 10, windowMs: 15 * 60 * 1000 },
  authRead: { max: 60, windowMs: 60 * 1000 },
  scan: { max: 20, windowMs: 15 * 60 * 1000 },
  api: { max: 100, windowMs: 60 * 1000 },
  general: { max: 1000, windowMs: 60 * 1000 },
} as const;

function getClientKey(request: NextRequest, bucket: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.ip || "unknown";
  // Key by bucket, not raw path — page visits and form submissions to the
  // same URL must not share a budget.
  return `${ip}:${bucket}`;
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

function getRateLimitConfig(
  pathname: string,
  method: string,
): { bucket: string; max: number; windowMs: number } {
  const isWrite = method !== "GET" && method !== "HEAD";

  if (pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/")) {
    return isWrite
      ? { bucket: "authWrite", ...RATE_LIMITS.authWrite }
      : { bucket: "authRead", ...RATE_LIMITS.authRead };
  }
  if (
    pathname.startsWith("/api/chat") ||
    pathname.startsWith("/api/submissions") ||
    pathname.startsWith("/api/contact") ||
    pathname.startsWith("/api/scan")
  ) {
    return { bucket: "scan", ...RATE_LIMITS.scan };
  }
  if (pathname.startsWith("/api/")) return { bucket: "api", ...RATE_LIMITS.api };
  return { bucket: "general", ...RATE_LIMITS.general };
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    `'nonce-${nonce}'`,
    `'strict-dynamic'`,
    `'self'`,
    isDev ? `'unsafe-eval'` : ``,
    `'unsafe-inline'`,
    `https:`,
  ]
    .filter(Boolean)
    .join(" ");

  const styleSrc = `'self' 'unsafe-inline'`;

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const cfg = getRateLimitConfig(pathname, request.method);
  const key = getClientKey(request, cfg.bucket);
  if (isRateLimited(key, cfg.max, cfg.windowMs)) {
    const retryAfter = Math.ceil(cfg.windowMs / 1000);
    // Server Actions send POSTs with the `Next-Action` header and expect a
    // Flight payload back. Returning plain JSON on 429 causes the client
    // to surface "An unexpected response was received from the server."
    // We still block, but return an empty 429 with the correct headers —
    // the action client then shows a network error, which renders cleanly.
    const isServerAction = request.headers.has("next-action");
    return new NextResponse(
      isServerAction
        ? null
        : JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          ...(isServerAction
            ? {}
            : { "Content-Type": "application/json" }),
          "X-RateLimit-Limit": cfg.max.toString(),
          "X-RateLimit-Window": retryAfter.toString(),
        },
      },
    );
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
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("X-XSS-Protection", "1; mode=block");

  if (pathname.startsWith("/api/")) {
    const allowedOrigin =
      process.env.ALLOWED_ORIGINS ||
      (isDev ? "http://localhost:3000" : "https://forgeguard.ai");
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:svg|png|jpg|jpeg|webp|woff2?|ttf)).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
