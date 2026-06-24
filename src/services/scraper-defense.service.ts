/**
 * Scraper detection and blacklist persistence for Aegis edge defense.
 */

import type { NextRequest } from "next/server";

const SCRAPER_UA_PATTERNS = [
  /headlesschrome/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /webdriver/i,
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /go-http-client/i,
  /scrapy/i,
  /bytespider/i,
  /petalbot/i,
];

/** Search / audit crawlers that must receive HTML on public marketing pages (PSI, SEO). */
const AUDIT_BOT_UA_PATTERNS = [
  /googlebot/i,
  /chrome-lighthouse/i,
  /lighthouse/i,
  /pagespeed/i,
  /google-inspectiontool/i,
  /bingbot/i,
];

const PUBLIC_MARKETING_EXACT = new Set([
  "/",
  "/about",
  "/terms",
  "/privacy",
  "/contact",
  "/careers",
  "/bazaar",
]);

function isPublicMarketingPath(pathname: string): boolean {
  if (PUBLIC_MARKETING_EXACT.has(pathname)) return true;
  return (
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/resources/") ||
    pathname.startsWith("/auth/")
  );
}

/**
 * True for PageSpeed / Lighthouse / search-engine audit user agents.
 */
export function isAuditOrSearchBot(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  return AUDIT_BOT_UA_PATTERNS.some((pattern) => pattern.test(ua));
}

/**
 * Skip PoW + burst rate limits for audit bots on GET/HEAD public marketing routes only.
 * Never bypasses /api/*, /dashboard/*, or /admin/*.
 */
export function shouldBypassScraperDefenseForAuditBot(
  request: NextRequest,
): boolean {
  if (!isAuditOrSearchBot(request)) return false;

  const method = request.method;
  if (method !== "GET" && method !== "HEAD") return false;

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) return false;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return false;
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return false;

  return isPublicMarketingPath(pathname);
}

/**
 * Extract client IP from Vercel-forwarded headers.
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Heuristic: automated scraper or headless browser fingerprint.
 */
export function isScraperRequest(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || ua.length < 10) return true;

  for (const pattern of SCRAPER_UA_PATTERNS) {
    if (pattern.test(ua)) return true;
  }

  const secChUa = request.headers.get("sec-ch-ua");
  const acceptLang = request.headers.get("accept-language");
  if (!acceptLang && request.method === "GET" && !request.nextUrl.pathname.startsWith("/api/")) {
    return true;
  }
  if (ua.includes("Chrome") && !secChUa && !ua.includes("Edg/")) {
    return true;
  }

  return false;
}

import { recordPerimeterViolation } from "@/lib/perimeter/record-violation";

/**
 * Persist violation — perimeter_events (hashed IP + GeoIP) + threat score + blocklist.
 */
export function logBlacklistedEntity(request: NextRequest, reason: string): void {
  recordPerimeterViolation(request, { reason, source: "scraper-defense" });
}
