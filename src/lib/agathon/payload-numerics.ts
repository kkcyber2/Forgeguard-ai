/**
 * Cast numeric values in log/finding payloads to strings for Supabase JSON safety.
 * Mirrors AI-red-team/agathon/supabase_sync.py stringify_payload_numerics.
 */

export function stringifyPayloadNumerics(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stringifyPayloadNumerics(v);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringifyPayloadNumerics(item));
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "nan";
    return String(value);
  }
  return value;
}
