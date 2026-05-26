import { isSovereignOperator } from "@/lib/access/sovereign-operator";

/** KK / sovereign operator — bypass rank, persona, and identity gates. */
export function hasSovereignBypass(email?: string | null): boolean {
  return isSovereignOperator(email);
}
