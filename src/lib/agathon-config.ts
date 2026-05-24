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
  | { Authorization: string }
  | undefined {
  return engineAuthHeaders();
}

/** Standard Bearer headers for all Vercel → Railway engine calls. */
export function engineAuthHeaders(): { Authorization: string } | undefined {
  const token = resolveEngineAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
