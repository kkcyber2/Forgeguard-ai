/** Next.js cache tag — invalidate when engine/webhooks update scan rows. */
export const SCANS_CACHE_TAG = "scans";

export function scansUserTag(userId: string): string {
  return `scans-user-${userId}`;
}
