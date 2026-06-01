/**
 * Vercel ↔ engine env alignment (Railway or Hugging Face Space).
 * Prefer PYTHON_ENGINE_URL / INTERNAL_SCAN_TOKEN; fall back to legacy names.
 *
 * Engine repo: https://github.com/valosd453-bit/AI-red-team
 * HF Spaces: Docker SDK, port 7860. Railway bunker: uses platform $PORT.
 * Vercel: set PYTHON_ENGINE_URL to your Railway public URL (no trailing slash).
 */

export type EngineUrlSource =
  | "PYTHON_ENGINE_URL"
  | "AGATHON_ORCHESTRATOR_URL"
  | "unset";

function normalizeEngineBase(raw: string): string {
  let base = raw.trim().replace(/\/+$/, "");
  if (base.endsWith("/health")) {
    base = base.slice(0, -"/health".length).replace(/\/+$/, "");
  }
  return base;
}

export function resolveEngineUrlSource(): EngineUrlSource {
  if (process.env.PYTHON_ENGINE_URL?.trim()) return "PYTHON_ENGINE_URL";
  if (process.env.AGATHON_ORCHESTRATOR_URL?.trim()) return "AGATHON_ORCHESTRATOR_URL";
  return "unset";
}

export function resolveEngineBaseUrl(): string | undefined {
  const python = process.env.PYTHON_ENGINE_URL?.trim();
  const legacy = process.env.AGATHON_ORCHESTRATOR_URL?.trim();
  const raw = python ?? legacy;
  if (!raw) return undefined;
  return normalizeEngineBase(raw);
}

export function resolveEngineAuthToken(): string | undefined {
  const token =
    process.env.INTERNAL_SCAN_TOKEN?.trim() ??
    process.env.AGATHON_INTERNAL_SECRET?.trim();
  return token || undefined;
}

/** Single source of truth for engine health probe URL. */
export function buildEngineHealthUrl(baseUrl: string): string {
  return `${normalizeEngineBase(baseUrl)}/health`;
}

/** Log the exact engine health URL (no secrets). */
export function logEngineProbeTarget(baseUrl: string | undefined): void {
  if (!baseUrl) {
    console.error("[engine] probe URL: <unset — configure PYTHON_ENGINE_URL>");
    return;
  }
  console.error("[engine] probe URL:", buildEngineHealthUrl(baseUrl));
}

/** Handshake diagnostics for engine health probes (no token values). */
export function logEngineHandshakeDiagnostics(): void {
  const baseUrl = resolveEngineBaseUrl();
  const healthUrl = baseUrl
    ? buildEngineHealthUrl(baseUrl)
    : "<unset — set PYTHON_ENGINE_URL>";
  const token = resolveEngineAuthToken();
  console.error(`ENGINE_URL_CALLED: ${healthUrl}`);
  console.error(`TOKEN_SENT: ${token ? "TRUE" : "FALSE"}`);
  console.error(`ENV_SOURCE: ${resolveEngineUrlSource()}`);
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
  if (!token) {
    console.error("TOKEN_SENT: FALSE");
    return undefined;
  }
  return {
    "x-internal-scan-token": token,
    Authorization: `Bearer ${token}`,
  };
}
