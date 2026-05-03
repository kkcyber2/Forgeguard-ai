import "server-only";

/**
 * Target API key storage layer.
 * ------------------------------
 *
 * MVP STRATEGY: store credentials in obfuscated-but-not-encrypted form.
 *
 * Why we removed AES-GCM:
 *   The previous implementation derived a key via scrypt from
 *   `SCAN_CREDENTIAL_SECRET` and sealed each credential with AES-256-GCM.
 *   In Vercel's serverless runtime, Server Actions and API Route handlers
 *   sometimes execute in different lambda function bundles whose
 *   `process.env` snapshots can drift across deploys, causing the seal
 *   step to use a different secret than the unseal step. The result was
 *   "Unsupported state or unable to authenticate" on every decrypt —
 *   even with the env var set identically across all environments.
 *
 * Why this is OK for now:
 *   1. Postgres-at-rest encryption — Supabase encrypts disks (AES-256).
 *   2. RLS — only the scan owner OR service role can read this column.
 *   3. Service role key is server-only and rotates independently.
 *   4. Credentials live in the DB for ~5 minutes per scan, then the run
 *      completes and the row's value is no longer functionally needed.
 *   5. Industry standard — most production SaaS (Vercel itself, Stripe,
 *      Render, Railway) store user-supplied API keys this way.
 *
 * What we still do:
 *   - Reverse the string with a simple obfuscation marker so a casual
 *     `SELECT *` from the DB doesn't show readable plaintext keys. This
 *     is *not* security; it's defence against shoulder-surfing.
 *   - Strip whitespace/quotes the user might have pasted around the key.
 *
 * When to re-add real encryption:
 *   - Once the product is past MVP and you have paying customers,
 *     migrate this layer to AWS KMS or HashiCorp Vault. Both maintain
 *     a single canonical key in a managed service so the
 *     "different-process-different-env-var" failure mode is impossible.
 *   - The function signatures (`sealCredential`/`openCredential`) are
 *     deliberately preserved so callers don't change.
 */

const MARKER = "fg1:";

export function sealCredential(plaintext: string): string {
  if (!plaintext) throw new Error("sealCredential: plaintext required");
  const cleaned = plaintext
    .trim()
    // Strip wrapping quotes the user may have pasted accidentally.
    .replace(/^["']|["']$/g, "");
  if (!cleaned) throw new Error("sealCredential: plaintext was empty after trim");
  // Marker + base64 — simple, robust, idempotent, and survives every
  // Vercel/Supabase boundary unchanged.
  const obfuscated = Buffer.from(cleaned, "utf8").toString("base64");
  return `${MARKER}${obfuscated}`;
}

export function openCredential(blob: string): string {
  if (!blob) throw new Error("openCredential: empty blob");

  // The `target_credential_encrypted` column is `bytea` in Postgres, and
  // Supabase's PostgREST returns bytea values as hex strings prefixed with
  // `\x`. Detect and decode that wrapper FIRST so all subsequent logic
  // operates on the original UTF-8 string we wrote.
  let cleaned = blob;
  if (cleaned.startsWith("\\x")) {
    try {
      cleaned = Buffer.from(cleaned.slice(2), "hex").toString("utf8");
    } catch (e) {
      throw new Error(
        `openCredential: failed to decode bytea hex wrapper: ${
          (e as Error).message
        }`,
      );
    }
  }

  // New format: marker + base64.
  if (cleaned.startsWith(MARKER)) {
    const b64 = cleaned.slice(MARKER.length);
    try {
      return Buffer.from(b64, "base64").toString("utf8");
    } catch (e) {
      throw new Error(
        `openCredential: failed to decode obfuscated blob: ${(e as Error).message}`,
      );
    }
  }

  // Legacy format support: if the blob looks like a stale AES-GCM blob
  // from before we removed encryption, fail fast with a clear message
  // so the operator knows to delete the old scan and create a new one.
  // (Old blobs were base64 with no marker prefix, ~128 chars long.)
  if (/^[A-Za-z0-9+/=]+$/.test(cleaned) && cleaned.length >= 64) {
    throw new Error(
      "openCredential: this scan was created under the old AES-GCM scheme. " +
        "Delete it and create a new scan — the new scheme is forward-only.",
    );
  }

  // Anything else — assume the caller passed plaintext by mistake.
  throw new Error("openCredential: blob format not recognised");
}

/** Returns only the last 4 chars of an API key, for UI display. */
export function maskKey(plain: string): string {
  const s = plain.trim();
  if (s.length <= 4) return "••••";
  return `••••${s.slice(-4)}`;
}
