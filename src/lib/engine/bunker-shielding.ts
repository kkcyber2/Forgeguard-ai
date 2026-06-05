/** Bunker shield copy + retry timing when PYTHON_ENGINE_URL is unreachable. */
export const BUNKER_SHIELDING_MESSAGE =
  "Bunker Shielding: Re-establishing Connection..." as const;

/** Shown when engine health probe succeeds — Smart-Mitigation perimeter active. */
export const FORTRESS_PERIMETER_HEALTH_MESSAGE =
  "Fortress Perimeter: Hardened (Sovereign Level)" as const;

/** Shown when Vercel/Railway returns 502/504 or Groq/OpenAI rate limits apply. */
export const ENGINE_CONGESTED_MESSAGE =
  "Engine Throttled: OpenAI/Groq limits reached. Standing by..." as const;

export const BUNKER_RETRY_MS = 5_000;
