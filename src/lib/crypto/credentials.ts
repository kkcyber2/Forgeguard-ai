import "server-only";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Target API key storage layer.
 * ------------------------------
 *
 * Two storage modes, selected at seal time by environment:
 *
 *   1. AES-256-GCM (opt-in)   — when SCAN_CREDENTIAL_ENCRYPT="true" AND
 *       SCAN_CREDENTIAL_SECRET is set. Each credential is sealed with a
 *       fresh 96-bit IV + 128-bit auth tag. Marker: `fg2:`.
 *   2. Base64 obfuscation (default) — marker `fg1:`. Not encryption; a
 *       shoulder-surfing defence. Supabase AES-256 disk encryption + RLS
 *       still protect the column at rest.
 *
 * Why AES-GCM is opt-in and not the default:
 *   The previous always-on AES-GCM implementation derived its key from
 *   `SCAN_CREDENTIAL_SECRET` and broke across Vercel serverless bundles
 *   whose `process.env` snapshots drifted, producing unrecoverable
 *   "unable to authenticate" decrypts. Making it opt-in means an operator
 *   who has confirmed the secret is stable across every bundle gets real
 *   encryption, while the default deployment never regresses.
 *
 * The key is sha-256(secret) — deterministic and drift-free as long as the
 * secret string is identical in every runtime (no scrypt salt to mismatch).
 *
 * `openCredential` auto-detects the format by marker, so mixed-mode rows
 * (some sealed before the flag was flipped) all open correctly.
 */

const MARKER_OBFUSCATE = "fg1:";
const MARKER_AES = "fg2:";
const IV_LEN = 12;
const TAG_LEN = 16;

function isEncryptionEnabled(): boolean {
  return process.env.SCAN_CREDENTIAL_ENCRYPT === "true" && !!process.env.SCAN_CREDENTIAL_SECRET;
}

function deriveKey(): Buffer {
  const secret = process.env.SCAN_CREDENTIAL_SECRET;
  if (!secret) throw new Error("openCredential/sealCredential: SCAN_CREDENTIAL_SECRET not set");
  return createHash("sha256").update(secret).digest(); // 32 bytes → AES-256
}

export type CredentialEncryptionMode = "aes-gcm" | "obfuscation";

/** Reports the active at-rest mode for truthful UI copy. Server-only. */
export function getCredentialEncryptionMode(): CredentialEncryptionMode {
  return isEncryptionEnabled() ? "aes-gcm" : "obfuscation";
}

export function sealCredential(plaintext: string): string {
  if (!plaintext) throw new Error("sealCredential: plaintext required");
  const cleaned = plaintext
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!cleaned) throw new Error("sealCredential: plaintext was empty after trim");

  if (isEncryptionEnabled()) {
    const key = deriveKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(cleaned, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const blob = Buffer.concat([iv, ct, tag]).toString("base64");
    return `${MARKER_AES}${blob}`;
  }

  const obfuscated = Buffer.from(cleaned, "utf8").toString("base64");
  return `${MARKER_OBFUSCATE}${obfuscated}`;
}

export function openCredential(blob: string): string {
  if (!blob) throw new Error("openCredential: empty blob");

  // bytea columns come back from PostgREST as `\x`-prefixed hex. Unwrap first.
  let cleaned = blob;
  if (cleaned.startsWith("\\x")) {
    try {
      cleaned = Buffer.from(cleaned.slice(2), "hex").toString("utf8");
    } catch (e) {
      throw new Error(`openCredential: failed to decode bytea hex wrapper: ${(e as Error).message}`);
    }
  }

  // AES-256-GCM mode.
  if (cleaned.startsWith(MARKER_AES)) {
    const secret = process.env.SCAN_CREDENTIAL_SECRET;
    if (!secret) {
      throw new Error(
        "openCredential: blob is AES-GCM sealed but SCAN_CREDENTIAL_SECRET is not set in this runtime. " +
          "Set the secret (and SCAN_CREDENTIAL_ENCRYPT=true) consistently across every bundle.",
      );
    }
    try {
      const buf = Buffer.from(cleaned.slice(MARKER_AES.length), "base64");
      const iv = buf.subarray(0, IV_LEN);
      const tag = buf.subarray(buf.length - TAG_LEN);
      const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
      const key = deriveKey();
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
      return pt.toString("utf8");
    } catch (e) {
      throw new Error(`openCredential: AES-GCM decrypt failed: ${(e as Error).message}`);
    }
  }

  // Obfuscation mode.
  if (cleaned.startsWith(MARKER_OBFUSCATE)) {
    try {
      return Buffer.from(cleaned.slice(MARKER_OBFUSCATE.length), "base64").toString("utf8");
    } catch (e) {
      throw new Error(`openCredential: failed to decode obfuscated blob: ${(e as Error).message}`);
    }
  }

  // Legacy stale AES-GCM blob from the removed always-on scheme (no marker).
  if (/^[A-Za-z0-9+/=]+$/.test(cleaned) && cleaned.length >= 64) {
    throw new Error(
      "openCredential: this scan was created under the old AES-GCM scheme. " +
        "Delete it and create a new scan — the new scheme is forward-only.",
    );
  }

  throw new Error("openCredential: blob format not recognised");
}

/** Returns only the last 4 chars of an API key, for UI display. */
export function maskKey(plain: string): string {
  const s = plain.trim();
  if (s.length <= 4) return "••••";
  return `••••${s.slice(-4)}`;
}
