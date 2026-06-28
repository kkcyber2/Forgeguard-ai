"use client";

/**
 * Mission channel E2EE — client-side AES-256-GCM envelope encryption.
 *
 * The channel key is derived (PBKDF2) from a passphrase the participants share
 * out-of-band plus the public mission id as salt. The passphrase is held only
 * in the browser (sessionStorage); the server stores ciphertext in
 * `mission_messages.body` and can never read plaintext.
 *
 * Wire format: `enc:v1:<ivB64>:<ctB64>`. Plaintext bodies pass through untouched
 * so unencrypted history still renders.
 */

const PREFIX = "enc:v1:";
const PBKDF2_ITERS = 150_000;
const SALT_NAMESPACE = "forgeguard:mission-channel:v1";

export function isEncrypted(body: string): boolean {
  return body.startsWith(PREFIX);
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function deriveChannelKey(passphrase: string, missionId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(`${SALT_NAMESPACE}:${missionId}`),
      iterations: PBKDF2_ITERS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptMessage(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return `${PREFIX}${bytesToB64(iv)}:${bytesToB64(new Uint8Array(ct))}`;
}

export async function decryptMessage(blob: string, key: CryptoKey): Promise<string> {
  if (!isEncrypted(blob)) return blob;
  const rest = blob.slice(PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep < 0) throw new Error("malformed ciphertext");
  const iv = b64ToBytes(rest.slice(0, sep));
  const ct = b64ToBytes(rest.slice(sep + 1));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return new TextDecoder().decode(pt);
}

const storageKey = (missionId: string) => `fg:mission-channel-key:${missionId}`;

export function storeChannelPassphrase(missionId: string, passphrase: string): void {
  try {
    sessionStorage.setItem(storageKey(missionId), passphrase);
  } catch {
    /* sessionStorage may be unavailable */
  }
}

export function loadChannelPassphrase(missionId: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(missionId));
  } catch {
    return null;
  }
}

export function clearChannelPassphrase(missionId: string): void {
  try {
    sessionStorage.removeItem(storageKey(missionId));
  } catch {
    /* noop */
  }
}
