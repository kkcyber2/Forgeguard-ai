"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import {
  buildCryptoQrCodeUrl,
  createNowPayment,
  fetchNowPaymentStatus,
  getSovereignCryptoWallet,
  isCryptoCheckoutConfigured,
  mapNowPaymentStatus,
  resolveCryptoPlan,
} from "@/lib/payments/crypto";
import { isRevenueSimulationMode } from "@/lib/payments/lemon-squeezy";
import type { PlanId } from "@/lib/plans";

export type GenerateDepositResult =
  | {
      ok: true;
      depositId: string;
      depositAddress: string;
      qrCode: string;
      amountUsdt: number;
      planName: string;
      payCurrency: string;
    }
  | { ok: false; error: string };

export type VerifyDepositResult =
  | { ok: true; status: "confirmed"; planName: string }
  | { ok: true; status: "pending" | "confirming"; message: string }
  | { ok: false; error: string };

/**
 * Generate a dynamic crypto deposit address for Startup / Sovereign plans.
 */
export async function generateDepositAddress(planName: string): Promise<GenerateDepositResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  if (!isCryptoCheckoutConfigured() && !isRevenueSimulationMode()) {
    return {
      ok: false,
      error: "Configure NOWPAYMENTS_API_KEY or SOVEREIGN_CRYPTO_WALLET",
    };
  }

  let planMeta: ReturnType<typeof resolveCryptoPlan>;
  try {
    planMeta = resolveCryptoPlan(planName);
  } catch {
    return { ok: false, error: `Unknown plan: ${planName}` };
  }

  const admin = createAdminSupabase();
  const depositId = crypto.randomUUID();
  const orderId = `fg-${user.id.slice(0, 8)}-${depositId.slice(0, 8)}`;

  let depositAddress = getSovereignCryptoWallet() ?? "";
  let paymentId: string | null = null;
  let payCurrency = "usdttrc20";
  let payAmount = planMeta.amountUsdt;

  try {
    const appUrl = publicEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const payment = await createNowPayment({
      amountUsdt: planMeta.amountUsdt,
      orderId,
      orderDescription: `ForgeGuard ${planMeta.planName} — ${user.email ?? user.id}`,
      ipnCallbackUrl: `${appUrl}/api/webhooks/nowpayments`,
    });
    depositAddress = payment.depositAddress;
    paymentId = payment.paymentId;
    payCurrency = payment.payCurrency;
    payAmount = payment.payAmount;
  } catch (err) {
    if (!depositAddress) {
      console.error("[crypto/generateDepositAddress]", err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to create crypto deposit",
      };
    }
    console.warn("[crypto/generateDepositAddress] NOWPayments unavailable — using static wallet");
  }

  const { error } = await admin.from("crypto_deposits").insert({
    id: depositId,
    user_id: user.id,
    plan_name: planMeta.planName,
    plan_id: planMeta.planId,
    amount_usdt: payAmount,
    deposit_address: depositAddress,
    pay_currency: payCurrency,
    payment_id: paymentId,
    status: "pending",
  });

  if (error) {
    console.error("[crypto/generateDepositAddress/db]", error.message);
    return { ok: false, error: "Failed to record deposit" };
  }

  return {
    ok: true,
    depositId,
    depositAddress,
    qrCode: buildCryptoQrCodeUrl(depositAddress, payAmount),
    amountUsdt: payAmount,
    planName: planMeta.planName,
    payCurrency,
  };
}

/** Poll crypto_deposits (and NOWPayments when available) for payment confirmation. */
export async function verifyCryptoDeposit(depositId: string): Promise<VerifyDepositResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const supabase = await createServerSupabase();
  const { data: deposit, error } = await supabase
    .from("crypto_deposits")
    .select("id, status, plan_name, payment_id, user_id")
    .eq("id", depositId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !deposit) {
    return { ok: false, error: "Deposit not found" };
  }

  if (deposit.status === "confirmed") {
    revalidatePath("/dashboard/billing");
    return { ok: true, status: "confirmed", planName: deposit.plan_name };
  }

  if (deposit.payment_id) {
    const remoteStatus = await fetchNowPaymentStatus(deposit.payment_id);
    if (remoteStatus) {
      const mapped = mapNowPaymentStatus(remoteStatus);
      if (mapped !== deposit.status) {
        const admin = createAdminSupabase();
        await admin
          .from("crypto_deposits")
          .update({ status: mapped })
          .eq("id", depositId)
          .eq("user_id", user.id);

        if (mapped === "confirmed") {
          revalidatePath("/dashboard/billing");
          return { ok: true, status: "confirmed", planName: deposit.plan_name };
        }

        return {
          ok: true,
          status: mapped === "confirming" ? "confirming" : "pending",
          message:
            mapped === "confirming"
              ? "Transaction detected — awaiting confirmations"
              : "Payment not yet detected on-chain",
        };
      }
    }
  }

  return {
    ok: true,
    status: deposit.status === "confirming" ? "confirming" : "pending",
    message:
      deposit.status === "confirming"
        ? "Transaction detected — awaiting confirmations"
        : "Payment not yet detected — keep this window open or retry in a moment",
  };
}

/** REVENUE_SIMULATION_MODE — instant crypto deposit confirmation without on-chain payment. */
export async function simulateCryptoDeposit(
  planId: Extract<PlanId, "startup" | "enterprise">,
): Promise<VerifyDepositResult> {
  if (!isRevenueSimulationMode()) {
    return { ok: false, error: "Revenue simulation is disabled" };
  }

  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const planMeta = resolveCryptoPlan(planId === "startup" ? "Startup" : "Sovereign");
  const admin = createAdminSupabase();
  const depositId = crypto.randomUUID();

  const { error } = await admin.from("crypto_deposits").insert({
    id: depositId,
    user_id: user.id,
    plan_name: planMeta.planName,
    plan_id: planMeta.planId,
    amount_usdt: planMeta.amountUsdt,
    deposit_address: getSovereignCryptoWallet() ?? "SIMULATED-VAULT",
    pay_currency: "usdttrc20",
    status: "confirmed",
  });

  if (error) {
    console.error("[crypto/simulate]", error.message);
    return { ok: false, error: "Simulation failed" };
  }

  revalidatePath("/dashboard/billing");
  return { ok: true, status: "confirmed", planName: planMeta.planName };
}
