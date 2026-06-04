"use server";

import { revalidatePath } from "next/cache";
import { purchaseBazaarScript } from "@/lib/payments/purchase-bazaar-script";
import type { BazaarPurchaseResult } from "@/lib/payments/lemon-squeezy";

export async function purchaseScript(
  scriptId: string,
): Promise<
  BazaarPurchaseResult & {
    spent?: number;
    platform_fee?: number;
    author_payout?: number;
    new_balance?: number;
  }
> {
  const result = await purchaseBazaarScript(scriptId);
  if (result.ok) {
    revalidatePath("/dashboard/bazaar");
  }
  return result;
}
