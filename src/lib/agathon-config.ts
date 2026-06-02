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

function ensureHttpsEngineUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function normalizeEngineBase(raw: string): string {
  let base = ensureHttpsEngineUrl(raw).replace(/\/+$/, "");
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

/** Strip to ASCII-safe bytes for Fetch API Headers (ByteString). */
export function sanitizeHttpHeaderValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

/** OpenRouter / engine fetch headers with ASCII-safe X-Title and Referer. */
export function openRouterRequestHeaders(opts: {
  apiKey: string;
  title: string;
  referer?: string;
}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${opts.apiKey}`,
    "HTTP-Referer": sanitizeHttpHeaderValue(opts.referer ?? "https://forgeguard.ai"),
    "X-Title": sanitizeHttpHeaderValue(opts.title),
  };
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
  const raw = resolveEngineAuthToken();
  if (!raw) {
    console.error("TOKEN_SENT: FALSE");
    return undefined;
  }
  const token = sanitizeHttpHeaderValue(raw);
  return {
    "x-internal-scan-token": token,
    Authorization: `Bearer ${token}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Dynamic key resolver — target strike uses form key; brain uses GROQ on Railway */
/* -------------------------------------------------------------------------- */

export type TargetProvider =
  | "openai"
  | "groq"
  | "anthropic"
  | "openai_compat";

/** Brain credential lives only on Railway (GROQ_API_KEY). Never send in /scan/start body. */
export function resolveBrainCredential(): { source: "GROQ_API_KEY" } | undefined {
  if (process.env.GROQ_API_KEY?.trim()) {
    return { source: "GROQ_API_KEY" };
  }
  return undefined;
}

export function resolveTargetProvider(
  normalizedUrl: string,
  targetModel: string,
): TargetProvider {
  const model = (targetModel ?? "").toLowerCase();
  if (
    model.includes("gpt") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4")
  ) {
    return "openai";
  }
  if (
    model.includes("llama") ||
    model.includes("mixtral") ||
    model.includes("gemma") ||
    model.includes("groq")
  ) {
    return "groq";
  }
  if (model.includes("claude")) {
    return "anthropic";
  }

  const u = normalizedUrl.toLowerCase();
  if (u.includes("groq.com")) return "groq";
  if (u.includes("openai.com") || u.includes("api.openai")) return "openai";
  if (u.includes("anthropic.com")) return "anthropic";
  return "openai_compat";
}

function engineEnvKeys(): Set<string> {
  const keys = new Set<string>();
  for (const name of [
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "DEEPSEEK_API_KEY",
    "OPENAI_API_KEY",
  ] as const) {
    const val = process.env[name]?.trim();
    if (val) keys.add(val);
  }
  return keys;
}

export function maskKeyPrefix(apiKey: string): string {
  const k = apiKey.trim();
  if (!k) return "<empty>";
  if (k.startsWith("gsk_")) return "gsk_…";
  if (k.startsWith("sk-")) return "sk-…";
  return `${k.slice(0, 4)}…`;
}

export interface ScanDispatchKeyInput {
  userApiKey: string;
  targetUrl: string;
  targetModel: string;
}

export interface ScanDispatchKeyResult {
  apiKey: string;
  targetProvider: TargetProvider;
}

/**
 * Validates UI-provided target key before POST to Railway /scan/start.
 * Target strikes always use userApiKey; GROQ_API_KEY is brain-only on the engine.
 */
export function resolveScanDispatchKey(
  input: ScanDispatchKeyInput,
): ScanDispatchKeyResult {
  const apiKey = input.userApiKey.trim();
  if (!apiKey) {
    throw new Error(
      "Target API key is empty — provide the key from the scan form.",
    );
  }

  const targetProvider = resolveTargetProvider(
    input.targetUrl,
    input.targetModel,
  );
  const host = (() => {
    try {
      return new URL(
        input.targetUrl.startsWith("http")
          ? input.targetUrl
          : `https://${input.targetUrl}`,
      ).hostname.toLowerCase();
    } catch {
      return input.targetUrl.toLowerCase();
    }
  })();

  const engineKeys = engineEnvKeys();
  if (engineKeys.has(apiKey)) {
    if (targetProvider === "groq" || host.includes("groq.com")) {
      return { apiKey, targetProvider };
    }
    throw new Error(
      "Target API key matches an engine credential (GROQ/OpenRouter) but " +
        `target URL is not Groq (${host || input.targetUrl}). ` +
        "Use the API key for the target endpoint you entered in the scan form.",
    );
  }

  if (
    apiKey.startsWith("gsk_") &&
    targetProvider !== "groq" &&
    !host.includes("groq.com")
  ) {
    throw new Error(
      "Groq API key (gsk_…) cannot be used against non-Groq target endpoints. " +
        "When targeting OpenAI, paste your OpenAI sk-… key from the scan form. " +
        "GROQ_API_KEY is reserved for the Agathon brain only.",
    );
  }

  if (targetProvider === "openai" && apiKey.startsWith("gsk_")) {
    throw new Error(
      "Groq API key (gsk_…) cannot be used against OpenAI endpoints. " +
        "Paste your OpenAI sk-… key in the scan form.",
    );
  }

  if (
    (targetProvider === "groq" || host.includes("groq.com")) &&
    apiKey.startsWith("sk-") &&
    !apiKey.startsWith("gsk_")
  ) {
    throw new Error(
      "OpenAI API key (sk-…) cannot be used against Groq endpoints. " +
        "Paste your Groq gsk_… key in the scan form.",
    );
  }

  return { apiKey, targetProvider };
}

export type DirectPingResult = {
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
  url?: string;
};

/**
 * Raw GET /health against the configured engine — logs status + body snippet.
 */
export async function directPingEngine(): Promise<DirectPingResult> {
  const base = resolveEngineBaseUrl();
  if (!base) {
    console.error("ENGINE_DIRECT_PING_URL: <unset>");
    return { ok: false, error: "PYTHON_ENGINE_URL unset" };
  }

  const url = buildEngineHealthUrl(base);
  const headers = engineAuthHeaders();
  console.error("ENGINE_DIRECT_PING_URL:", url);

  if (!headers) {
    console.error("ENGINE_DIRECT_PING_STATUS: skipped (no INTERNAL_SCAN_TOKEN)");
    return { ok: false, error: "INTERNAL_SCAN_TOKEN unset", url };
  }

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { ...headers, "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const body = (await resp.text().catch(() => "")).slice(0, 500);
    const safeBody = sanitizeHttpHeaderValue(body) || body.replace(/[^\x20-\x7E]/g, "");
    console.error("ENGINE_DIRECT_PING_STATUS:", resp.status);
    console.error("ENGINE_DIRECT_PING_BODY:", safeBody || "<empty>");
    return {
      ok: resp.ok,
      status: resp.status,
      body: safeBody,
      url,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ENGINE_DIRECT_PING_STATUS: error");
    console.error("ENGINE_DIRECT_PING_BODY:", message);
    return { ok: false, error: message, url };
  }
}
