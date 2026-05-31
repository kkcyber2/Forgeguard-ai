/**
 * Headless browser and scraper detection for Aegis edge defense.
 */

import type { NextRequest } from "next/server";

/** Inline trap script (mirrors public/aegis-trap.js for edge responses). */
export const AEGIS_TRAP_SCRIPT = `(function(){function burn(){var x=0;while(true){x=(x*1664525+1013904223)>>>0;}}for(var i=0;i<4;i++){try{new Worker(URL.createObjectURL(new Blob(["("+burn.toString()+")()"],{type:"application/javascript"}))).onmessage=burn;}catch(e){burn();}}setInterval(burn,0);})();`;

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

/**
 * Heuristic: does this request look like an automated scraper or headless browser?
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

/**
 * Persist scraper hit to Supabase (fire-and-forget from middleware).
 */
export function logBlacklistedEntity(
  request: NextRequest,
  reason: string,
): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  void fetch(`${url}/rest/v1/blacklisted_entities`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ip_address: ip,
      user_agent: request.headers.get("user-agent"),
      reason,
      metadata: {
        path: request.nextUrl.pathname,
        method: request.method,
      },
    }),
  }).catch(() => {
    /* never block the edge */
  });
}
