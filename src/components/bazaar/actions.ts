"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";

export async function purchaseScript(
  scriptId: string,
): Promise<{
  error?: string;
  code?: string;
  ok?: boolean;
  spent?: number;
  platform_fee?: number;
  author_payout?: number;
  new_balance?: number;
}> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabase();

  const { data: frozen } = await supabase
    .from("user_wallets")
    .select("is_frozen")
    .eq("user_id", user.id)
    .maybeSingle();

  if (frozen?.is_frozen) {
    return { error: "Wallet frozen.", code: "WALLET_FROZEN" };
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("purchase_bazaar_script", {
    p_buyer_id: user.id,
    p_script_id: scriptId,
  });

  if (error) return { error: error.message };

  const result = data as Record<string, unknown> | null;
  if (!result) return { error: "Purchase failed." };
  if (result.error) {
    return {
      error: String(result.error),
      code: result.code ? String(result.code) : undefined,
    };
  }

  revalidatePath("/dashboard/bazaar");
  return {
    ok: true,
    code: result.code ? String(result.code) : undefined,
    spent: typeof result.spent === "number" ? result.spent : undefined,
    platform_fee: typeof result.platform_fee === "number" ? result.platform_fee : undefined,
    author_payout: typeof result.author_payout === "number" ? result.author_payout : undefined,
    new_balance: typeof result.new_balance === "number" ? result.new_balance : undefined,
  };
}
