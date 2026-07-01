"use client";

/**
 * Team channel E2EE — reuses mission channel crypto with team-scoped storage.
 */
export {
  deriveChannelKey,
  encryptMessage,
  decryptMessage,
  isEncrypted,
} from "@/lib/e2ee/channel-crypto";

const storageKey = (teamId: string) => `fg:team-channel-key:${teamId}`;

export function storeTeamPassphrase(teamId: string, passphrase: string): void {
  try {
    sessionStorage.setItem(storageKey(teamId), passphrase);
  } catch {
    /* sessionStorage may be unavailable */
  }
}

export function loadTeamPassphrase(teamId: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(teamId));
  } catch {
    return null;
  }
}

export function clearTeamPassphrase(teamId: string): void {
  try {
    sessionStorage.removeItem(storageKey(teamId));
  } catch {
    /* noop */
  }
}
