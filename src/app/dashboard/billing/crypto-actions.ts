"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { resolveAppUrl } from "@/lib/app-url";
import {
  buildCryptoPaymentUri,
  buildCryptoQrCodeUrl,
  createNowPayment,
  fetchNowPaymentStatus,
  getNowPaymentsApiKey,
  getSovereignCryptoWallet,
  grantConfirmedCryptoDeposit,
  isCryptoCheckoutConfigured,
  mapNowPaymentStatus,
  resolveCryptoPlan,
  resolveCreditPack,
} from "@/lib/payments/crypto";
import {
  isUsdtStableCoin,
  resolveCatalogPayAmount,
} from "@/lib/payments/crypto-format";
import { isRevenueSimulationMode } from "@/lib/payments/lemon-squeezy";
import type { PlanId } from "@/lib/plans";

const PAYMENTS_UNAVAILABLE = "Payments temporarily unavailable";

type CryptoDepositInsert = {
  id: string;
  user_id: string;
  plan_name: string;
  plan_id: string;
  deposit_type: "subscription" | "credit_pack";
  amount_usdt: number;
  pay_amount?: number;
  deposit_address: string;
  pay_currency: string;
  payment_id: string | null;
  status: string;
  credit_amount?: number;
};

/** Live DB retains legacy NOT NULL columns address_generated + amount_usd — mirror canonical fields. */
function buildCryptoDepositRow(row: CryptoDepositInsert): Record<string, unknown> {
  return {
    ...row,
    address_generated: row.deposit_address,
    amount_usd: row.amount_usdt,
  };
}

function logDepositDbError(scope: string, error: { message: string; code?: string; details?: string; hint?: string }) {
  console.error(`[crypto/${scope}/db]`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

async function insertCryptoDeposit(
  admin: ReturnType<typeof createAdminSupabase>,
  row: CryptoDepositInsert,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (admin as any).from("crypto_deposits").insert(buildCryptoDepositRow(row));
}

export type GenerateDepositResult =
  | {
      ok: true;
      depositId: string;
      depositAddress: string;
      paymentId: string;
      /** Primary QR — prefers NOWPayments checkout URL when available. */
      qrCode: string;
      checkoutQrCode: string;
      walletQrCode: string;
      paymentUri: string;
      amountUsdt: number;
      payAmount: number;
      planName: string;
      payCurrency: string;
      invoiceUrl?: string;
      payUrl?: string;
    }
  | { ok: false; error: string };

function buildDepositQrPayloads(
  depositAddress: string,
  payAmount: number,
  payCurrency: string,
  payUrl?: string,
  invoiceUrl?: string,
) {
  const checkoutTarget = payUrl?.trim() || invoiceUrl?.trim();
  const checkoutQrCode = checkoutTarget
    ? buildCryptoQrCodeUrl(depositAddress, payAmount, payCurrency, checkoutTarget)
    : buildCryptoQrCodeUrl(depositAddress, payAmount, payCurrency);
  const walletQrCode = buildCryptoQrCodeUrl(depositAddress, payAmount, payCurrency);
  return {
    checkoutQrCode,
    walletQrCode,
    qrCode: checkoutTarget ? checkoutQrCode : walletQrCode,
  };
}

async function createNowPaymentsDeposit(params: {
  catalogAmount: number;
  orderId: string;
  orderDescription: string;
  depositRow: Omit<
    CryptoDepositInsert,
    "deposit_address" | "pay_currency" | "payment_id" | "pay_amount" | "status" | "amount_usdt"
  >;
}): Promise<GenerateDepositResult> {
  if (!getNowPaymentsApiKey()) {
    return { ok: false, error: PAYMENTS_UNAVAILABLE };
  }

  const admin = createAdminSupabase();
  let payment;

  try {
    const appUrl = resolveAppUrl();
    payment = await createNowPayment({
      amountUsdt: params.catalogAmount,
      orderId: params.orderId,
      orderDescription: params.orderDescription,
      ipnCallbackUrl: `${appUrl}/api/webhooks/nowpayments`,
    });
  } catch (err) {
    console.error("[crypto/createNowPaymentsDeposit]", err);
    return { ok: false, error: PAYMENTS_UNAVAILABLE };
  }

  if (!payment.paymentId) {
    return { ok: false, error: PAYMENTS_UNAVAILABLE };
  }

  const payCurrency = payment.payCurrency;
  const payAmount = isUsdtStableCoin(payCurrency)
    ? resolveCatalogPayAmount(params.catalogAmount, payCurrency)
    : payment.payAmount;

  const { error } = await insertCryptoDeposit(admin, {
    ...params.depositRow,
    amount_usdt: params.catalogAmount,
    pay_amount: payAmount,
    deposit_address: payment.depositAddress,
    pay_currency: payCurrency,
    payment_id: payment.paymentId,
    status: "pending",
  });

  if (error) {
    logDepositDbError("createNowPaymentsDeposit", error);
    return { ok: false, error: "Failed to record deposit" };
  }

  const paymentUri = buildCryptoPaymentUri(payCurrency, payment.depositAddress, payAmount);
  const qrPayloads = buildDepositQrPayloads(
    payment.depositAddress,
    payAmount,
    payCurrency,
    payment.payUrl,
    payment.invoiceUrl,
  );

  return {
    ok: true,
    depositId: params.depositRow.id,
    depositAddress: payment.depositAddress,
    paymentId: payment.paymentId,
    ...qrPayloads,
    paymentUri,
    amountUsdt: params.catalogAmount,
    payAmount,
    planName: params.depositRow.plan_name,
    payCurrency,
    invoiceUrl: payment.invoiceUrl,
    payUrl: payment.payUrl,
  };
}

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
    return { ok: false, error: PAYMENTS_UNAVAILABLE };
  }

  let planMeta: ReturnType<typeof resolveCryptoPlan>;
  try {
    planMeta = resolveCryptoPlan(planName);
  } catch {
    return { ok: false, error: `Unknown plan: ${planName}` };
  }

  const depositId = crypto.randomUUID();
  const orderId = `fg-${user.id.slice(0, 8)}-${depositId.slice(0, 8)}`;

  return createNowPaymentsDeposit({
    catalogAmount: planMeta.amountUsdt,
    orderId,
    orderDescription: `ForgeGuard ${planMeta.planName} — ${user.email ?? user.id}`,
    depositRow: {
      id: depositId,
      user_id: user.id,
      plan_name: planMeta.planName,
      plan_id: planMeta.planId,
      deposit_type: "subscription",
    },
  });
}

/** Generate a credit-pack deposit ($10 → 100 Bazaar credits). */
export async function generateCreditPackDeposit(
  packName = "Starter Pack",
): Promise<GenerateDepositResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  if (!isCryptoCheckoutConfigured() && !isRevenueSimulationMode()) {
    return { ok: false, error: PAYMENTS_UNAVAILABLE };
  }

  let packMeta: ReturnType<typeof resolveCreditPack>;
  try {
    packMeta = resolveCreditPack(packName);
  } catch {
    return { ok: false, error: `Unknown credit pack: ${packName}` };
  }

  const depositId = crypto.randomUUID();
  const orderId = `fg-credits-${user.id.slice(0, 8)}-${depositId.slice(0, 8)}`;

  return createNowPaymentsDeposit({
    catalogAmount: packMeta.amountUsdt,
    orderId,
    orderDescription: `ForgeGuard ${packMeta.packName} (${packMeta.creditAmount} credits)`,
    depositRow: {
      id: depositId,
      user_id: user.id,
      plan_name: packMeta.packName,
      plan_id: "credit_pack",
      deposit_type: "credit_pack",
      credit_amount: packMeta.creditAmount,
    },
  });
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
    const admin = createAdminSupabase();
    await grantConfirmedCryptoDeposit(admin, depositId);
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
          await grantConfirmedCryptoDeposit(admin, depositId);
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

  const { error } = await insertCryptoDeposit(admin, {
    id: depositId,
    user_id: user.id,
    plan_name: planMeta.planName,
    plan_id: planMeta.planId,
    deposit_type: "subscription",
    amount_usdt: planMeta.amountUsdt,
    deposit_address: getSovereignCryptoWallet() ?? "SIMULATED-VAULT",
    pay_currency: "usdttrc20",
    payment_id: null,
    status: "confirmed",
  });

  if (error) {
    logDepositDbError("simulate", error);
    return { ok: false, error: "Simulation failed" };
  }

  await grantConfirmedCryptoDeposit(admin, depositId);

  revalidatePath("/dashboard/billing");
  return { ok: true, status: "confirmed", planName: planMeta.planName };
}
