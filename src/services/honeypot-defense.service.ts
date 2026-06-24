/**
 * Kinetic honeypots — trap scrapers probing sensitive paths.
 */

import type { NextRequest } from "next/server";

/** Paths that trigger immediate blacklist + bunker redirect. */
export const KINETIC_HONEYPOT_PATHS = [
  "/.env",
  "/.env.local",
  "/api/.env.bak",
  "/api/.env",
  "/wp-admin",
  "/admin/setup",
] as const;

export const BUNKER_CHALLENGE_PATH = "/dashboard/bunker/challenge";

export function isHoneypotPath(pathname: string): boolean {
  const p = pathname.toLowerCase().split("?")[0] ?? "";
  return KINETIC_HONEYPOT_PATHS.some(
    (trap) => p === trap || p.startsWith(`${trap}/`),
  );
}

/** @deprecated Use isHoneypotPath */
export const isKineticHoneypotPath = isHoneypotPath;

export function honeypotRedirectUrl(request: NextRequest, trappedPath: string): URL {
  const url = new URL(BUNKER_CHALLENGE_PATH, request.url);
  url.searchParams.set("trap", trappedPath);
  return url;
}
