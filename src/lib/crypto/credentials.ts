import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Symmetric AES-256-GCM envelope for target API keys.
 * ---------------------------------------------------
 * Keys are never stored in plaintext. They're sealed with a server-side
 * secret (`SCAN_CREDENTIAL_SECRET`) derived via scrypt, then written to
 * `scans.target_credential_encrypted` as a base64 blob.
 *
 * Blob layout:
 *   [16 bytes salt][12 bytes iv][ciphertext][16 bytes auth tag]
 *
 * Rotating the secret requires re-encrypting rows, which is acceptable
 * because keys are short-lived and tied to individual scans.
 */

const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;

function getMasterSecret(): string {
  const s = process.env.SCAN_CREDENTIAL_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "[forgeguard:crypto] SCAN_CREDENTIAL_SECRET must be set to a random 32+ char string. " +
        "Generate one with `openssl rand -hex 32` and put it in .env.local.",
    );
  }
  return s;
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

export function sealCredential(plaintext: string): string {
  if (!plaintext) throw new Error("sealCredential: plaintext required");
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(getMasterSecret(), salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, ct, tag]).toString("base64");
}

export function openCredential(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < SALT_LEN + IV_LEN + TAG_LEN + 1) {
    throw new Error("openCredential: malformed blob");
  }
  const salt = buf.subarray(0, SALT_LEN);
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(SALT_LEN + IV_LEN, buf.length - TAG_LEN);
  const key = deriveKey(getMasterSecret(), salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Returns only the last 4 chars of an API key, for UI display. */
export function maskKey(plain: string): string {
  const s = plain.trim();
  if (s.length <= 4) return "••••";
  return `••••${s.slice(-4)}`;
}
