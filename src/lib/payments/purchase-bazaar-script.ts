import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import {
  getBazaarCheckoutUrl,
  type BazaarPurchaseResult,
} from "@/lib/payments/lemon-squeezy";

export async function purchaseBazaarScript(
  scriptId: string,
): Promise<BazaarPurchaseResult> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabase();
  const { data: script, error: loadErr } = await supabase
    .from("bazaar_scripts")
    .select(
      "id, name, author_id, code, code_content, price_usd, is_free, is_published, is_removed, audit_verdict",
    )
    .eq("id", scriptId)
    .maybeSingle();

  if (loadErr || !script) {
    return { error: "Script not found." };
  }
  if (!script.is_published || script.is_removed || script.audit_verdict !== "cleared") {
    return { error: "Script not available." };
  }

  const scriptCode = script.code_content ?? script.code ?? "";
  const priceUsd = Number(script.price_usd ?? 0);
  const isFree = Boolean(script.is_free) || priceUsd === 0;

  if (script.author_id === user.id) {
    return { ok: true, code: scriptCode, already_owned: true };
  }

  const { data: existing } = await supabase
    .from("bazaar_purchases")
    .select("id")
    .eq("script_id", scriptId)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (existing) {
    return { ok: true, code: scriptCode, already_owned: true };
  }

  if (!isFree) {
    return {
      redirectUrl: getBazaarCheckoutUrl(scriptId, user.id, priceUsd),
    };
  }

  const { error: insertErr } = await supabase.from("bazaar_purchases").insert({
    script_id: scriptId,
    buyer_id: user.id,
    author_id: script.author_id,
    amount_usd: 0,
  });

  if (insertErr) {
    return { error: insertErr.message };
  }

  const admin = createAdminSupabase();
  await admin.rpc("increment_purchase", { p_script_id: scriptId, p_revenue: 0 });

  return { ok: true, code: scriptCode };
}
