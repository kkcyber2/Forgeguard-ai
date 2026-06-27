"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/server";
import { resolveAppUrl } from "@/lib/app-url";
import {
  createNowPaymentsInvoice,
  getNowPaymentsApiKey,
  grantConfirmedCryptoDeposit,
  isCryptoCheckoutConfigured,
  NowPaymentsRateLimitError,
  resolveCreditPack,
  resolveCryptoPlan,
  getSovereignCryptoWallet,
} from "@/lib/payments/crypto";
import { isRevenueSimulationMode } from "@/lib/payments/lemon-squeezy";
import type { PlanId } from "@/lib/plans";

const PAYMENTS_UNAVAILABLE = "Payments temporarily unavailable";
const CHECKOUT_CONFIG_ERROR = "Checkout configuration error — contact support";

/** Map NOWPayments API errors to user-facing checkout messages. */
function mapCheckoutError(err: unknown): string {
  if (err instanceof NowPaymentsRateLimitError) {
    return "Payment service busy, retry in 60s";
  }
  if (!(err instanceof Error)) {
    return PAYMENTS_UNAVAILABLE;
  }
  if (err.message.includes("429")) {
    return "Payment service busy, retry in 60s";
  }
  if (err.message.includes("NOWPAYMENTS_API_KEY is not configured")) {
    return PAYMENTS_UNAVAILABLE;
  }
  if (err.message.includes("NOWPayments invoice failed (400)")) {
    return CHECKOUT_CONFIG_ERROR;
  }
  if (err.message.includes("NOWPayments invoice failed (401)")) {
    return PAYMENTS_UNAVAILABLE;
  }
  return PAYMENTS_UNAVAILABLE;
}

type CryptoDepositInsert = {
  id: string;
  user_id: string;
  plan_name: string;
  plan_id: string;
  deposit_type: "subscription" | "credit_pack";
  amount_usdt: number;
  deposit_address: string;
  pay_currency: string;
  payment_id: string | null;
  order_id?: string;
  invoice_url?: string;
  credit_amount?: number;
  status: string;
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

export type CreateInvoiceResult =
  | { ok: true; invoiceUrl: string; depositId: string }
  | { ok: false; error: string };

/**
 * Create a NOWPayments hosted invoice for a subscription or credit-pack
 * purchase and return the invoice_url the user is redirected to. The
 * actual access grant happens via the verified IPN webhook when the
 * payment status reaches `finished` / `confirmed`.
 */
export async function createCheckoutInvoice(params: {
  planName: string;
  depositKind: "subscription" | "credit_pack";
}): Promise<CreateInvoiceResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  if (!isCryptoCheckoutConfigured() && !isRevenueSimulationMode()) {
    return { ok: false, error: PAYMENTS_UNAVAILABLE };
  }

  const depositId = crypto.randomUUID();
  const orderId = `fg-${params.depositKind === "credit_pack" ? "credits" : "sub"}-${user.id.slice(0, 8)}-${depositId.slice(0, 8)}`;
  const appUrl = resolveAppUrl();

  let catalogAmount: number;
  let planId: string;
  let planName: string;
  let creditAmount: number | undefined;

  if (params.depositKind === "credit_pack") {
    const pack = resolveCreditPack(params.planName);
    catalogAmount = pack.amountUsdt;
    planId = "credit_pack";
    planName = pack.packName;
    creditAmount = pack.creditAmount;
  } else {
    const plan = resolveCryptoPlan(params.planName);
    catalogAmount = plan.amountUsdt;
    planId = plan.planId;
    planName = plan.planName;
  }

  const successUrl =
    params.depositKind === "credit_pack"
      ? `${appUrl}/dashboard/bazaar?credits=1`
      : `${appUrl}/dashboard/billing?upgraded=1`;
  const cancelUrl = `${appUrl}/dashboard/billing?cancelled=1`;

  let invoice;
  try {
    invoice = await createNowPaymentsInvoice({
      amountUsd: catalogAmount,
      orderId,
      orderDescription: `ForgeGuard ${planName} — ${user.email ?? user.id}`,
      ipnCallbackUrl: `${appUrl}/api/webhooks/nowpayments`,
      successUrl,
      cancelUrl,
    });
  } catch (err) {
    console.error("[crypto/createCheckoutInvoice]", err);
    return { ok: false, error: mapCheckoutError(err) };
  }

  const admin = createAdminSupabase();
  const { error } = await insertCryptoDeposit(admin, {
    id: depositId,
    user_id: user.id,
    plan_name: planName,
    plan_id: planId,
    deposit_type: params.depositKind,
    amount_usdt: catalogAmount,
    deposit_address: invoice.invoiceId,
    pay_currency: invoice.payCurrency ?? "usdttrc20",
    payment_id: invoice.invoiceId,
    order_id: orderId,
    invoice_url: invoice.invoiceUrl,
    credit_amount: creditAmount,
    status: "pending",
  });

  if (error) {
    logDepositDbError("createCheckoutInvoice", error);
    // The invoice exists at NOWPayments; the IPN will still match by order_id.
  }

  return { ok: true, invoiceUrl: invoice.invoiceUrl, depositId };
}

export type SimulateDepositResult =
  | { ok: true; status: "confirmed"; planName: string }
  | { ok: false; error: string };

/** REVENUE_SIMULATION_MODE — instant crypto deposit confirmation without on-chain payment. */
export async function simulateCryptoDeposit(
  planId: Extract<PlanId, "startup" | "enterprise">,
): Promise<SimulateDepositResult> {
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
