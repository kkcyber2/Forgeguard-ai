import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import type { SovereignRole } from "@/lib/access/parallel-sovereignty";

export function isForbiddenSovereignAccess(
  email: string | null | undefined,
  pathname: string,
  persona?: SovereignRole | null,
): boolean {
  if (isSovereignOperator(email)) return false;
  if (pathname.startsWith("/admin")) return true;
  if (persona === "dev") return true;
  return false;
}
