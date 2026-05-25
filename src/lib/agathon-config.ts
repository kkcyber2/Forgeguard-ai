/**
 * Vercel ↔ Railway env alignment.
 * Prefer PYTHON_ENGINE_URL / INTERNAL_SCAN_TOKEN; fall back to legacy names.
 */

export function resolveEngineBaseUrl(): string | undefined {
  const raw =
    process.env.PYTHON_ENGINE_URL ?? process.env.AGATHON_ORCHESTRATOR_URL;
  return raw?.replace(/\/$/, "");
}

export function resolveEngineAuthToken(): string | undefined {
  return (
    process.env.INTERNAL_SCAN_TOKEN ?? process.env.AGATHON_INTERNAL_SECRET
  );
}

/** @deprecated Use engineAuthHeaders */
export function engineAuthorizationHeader():
  | Record<string, string>
  | undefined {
  return engineAuthHeaders();
}

/**
 * Standard auth headers for all Vercel → Railway Python engine calls.
 * Sends x-internal-scan-token (primary) plus Bearer for legacy engine paths.
 */
export function engineAuthHeaders():
  | { "x-internal-scan-token": string; Authorization: string }
  | undefined {
  const token = resolveEngineAuthToken();
  if (!token) return undefined;
  return {
    "x-internal-scan-token": token,
    Authorization: `Bearer ${token}`,
  };
}
