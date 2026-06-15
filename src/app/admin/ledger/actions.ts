"use server";

import { releaseBountyFunds } from "../bounties/actions";

/**
 * Admin ledger — atomic escrow → hacker wallet via release_kinetic_bounty RPC.
 * Moves USD from bounty_escrow into researcher user_wallets (10% platform fee).
 */
export async function releaseKineticBountyPayout(escrowId: string) {
  return releaseBountyFunds(escrowId);
}
