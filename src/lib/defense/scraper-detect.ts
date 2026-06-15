/**
 * @deprecated Import from `@/services/scraper-defense.service` — re-export shim.
 */
export {
  getClientIp,
  isAuditOrSearchBot,
  isScraperRequest,
  logBlacklistedEntity,
  shouldBypassScraperDefenseForAuditBot,
} from "@/services/scraper-defense.service";

/** Legacy trap script — superseded by SHA-256 PoW challenges. */
export const AEGIS_TRAP_SCRIPT = "";
