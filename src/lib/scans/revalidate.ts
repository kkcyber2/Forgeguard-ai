import { revalidateTag } from "next/cache";
import { SCANS_CACHE_TAG } from "@/lib/scans/cache-tags";

/** Bust dashboard scan caches after engine/webhook DB writes. */
export function revalidateScansCache(userId?: string | null): void {
  revalidateTag(SCANS_CACHE_TAG);
  if (userId) {
    revalidateTag(`scans-user-${userId}`);
  }
}
