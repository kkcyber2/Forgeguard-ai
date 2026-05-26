/** Canonical production origin for ForgeGuard AI. */
export const CANONICAL_APP_URL = "https://www.forgeguard-ai.com";

export function resolveAppUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return CANONICAL_APP_URL;
  return "http://localhost:3000";
}
