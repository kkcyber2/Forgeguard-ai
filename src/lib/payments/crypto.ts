import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCreditPack, getPlanMeta, type PlanId } from "@/lib/plans";
import {
  isUsdtStableCoin,
  resolveCatalogPayAmount,
} from "@/lib/payments/crypto-format";

const NOWPAYMENTS_API = "https://api.nowpayments.io/v1";

export type CryptoPayCurrency = "usdttrc20" | "usdterc20" | "sol" | "btc";

export interface CryptoPlanMeta {
  planId: Extract<PlanId, "startup" | "enterprise">;
  planName: string;
  amountUsdt: number;
}

export interface NowPaymentResult {
  paymentId: string;
  depositAddress: string;
  payAmount: number;
  payCurrency: CryptoPayCurrency;
  status: string;
  invoiceUrl?: string;
  payUrl?: string;
}

/** Map display plan name → plan id + USDT amount (subscription checkout). */
export function resolveCryptoPlan(planName: string): CryptoPlanMeta {
  const key = planName.trim().toLowerCase();
  const planId: Extract<PlanId, "startup" | "enterprise"> =
    key === "startup" ? "startup" : key === "sovereign" || key === "enterprise" ? "enterprise" : (() => {
      throw new Error(`Unknown plan: ${planName}`);
    })();

  const meta = getPlanMeta(planId);
  return { planId, planName: meta.name, amountUsdt: meta.price };
}

export interface CryptoCreditPackMeta {
  packId: "starter";
  packName: string;
  amountUsdt: number;
  creditAmount: number;
}

/** Credit pack checkout — wallet credits only (Bazaar). */
export function resolveCreditPack(planName: string): CryptoCreditPackMeta {
  const key = planName.trim().toLowerCase();
  const packId: "starter" =
    key === "starter" || key === "starter pack" || key === "credit pack" ? "starter" : (() => {
      throw new Error(`Unknown credit pack: ${planName}`);
    })();
  const pack = getCreditPack(packId);
  return {
    packId,
    packName: pack.name,
    amountUsdt: pack.priceUsd,
    creditAmount: pack.credits,
  };
}

/** Wallet-compatible payment URI for QR / deep links. */
function isTronCurrency(payCurrency: string): boolean {
  const currency = payCurrency.trim().toLowerCase();
  return (
    currency === "usdttrc20" ||
    currency === "trx" ||
    currency === "tron" ||
    (currency.startsWith("usdt") && currency.includes("trc"))
  );
}

export function buildCryptoPaymentUri(
  payCurrency: string,
  address: string,
  payAmount: number,
): string {
  const currency = payCurrency.trim().toLowerCase();
  const amount = String(payAmount);

  if (currency === "btc" || currency === "bitcoin") {
    return `bitcoin:${address}?amount=${amount}`;
  }
  if (currency === "sol" || currency === "solana") {
    return `solana:${address}?amount=${amount}`;
  }
  if (isTronCurrency(currency)) {
    return `tron:${address}`;
  }
  if (currency === "usdterc20" || currency === "eth" || currency === "ethereum") {
    return `ethereum:${address}?value=${amount}`;
  }
  return `${address}?amount=${amount}`;
}

/** Standard black-on-white QR — best wallet scanner compatibility. */
export function buildCryptoQrCodeUrl(
  depositAddress: string,
  payAmount?: number,
  payCurrency = "usdttrc20",
): string {
  const payload = isTronCurrency(payCurrency)
    ? `tron:${depositAddress}`
    : payAmount != null && payAmount > 0
      ? buildCryptoPaymentUri(payCurrency, depositAddress, payAmount)
      : depositAddress;
  const params = new URLSearchParams({
    size: "240x240",
    color: "000000",
    bgcolor: "ffffff",
    margin: "12",
    data: payload,
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return undefined;
}

export function getNowPaymentsApiKey(): string | undefined {
  return readEnv("NOWPAYMENTS_API_KEY");
}

export function getSovereignCryptoWallet(): string | undefined {
  return readEnv("SOVEREIGN_CRYPTO_WALLET");
}

export function isCryptoCheckoutConfigured(): boolean {
  return Boolean(getNowPaymentsApiKey() || getSovereignCryptoWallet());
}

/** Create a NOWPayments invoice and return the dynamic deposit address. */
export async function createNowPayment(params: {
  amountUsdt: number;
  orderId: string;
  orderDescription: string;
  payCurrency?: CryptoPayCurrency;
  ipnCallbackUrl?: string;
}): Promise<NowPaymentResult> {
  const apiKey = getNowPaymentsApiKey();
  if (!apiKey) {
    throw new Error("NOWPAYMENTS_API_KEY is not configured");
  }

  const payCurrency = params.payCurrency ?? "usdttrc20";
  const stableUsdt = isUsdtStableCoin(payCurrency);

  const res = await fetch(`${NOWPAYMENTS_API}/payment`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: params.amountUsdt,
      price_currency: stableUsdt ? "usdt" : "usd",
      pay_currency: payCurrency,
      order_id: params.orderId,
      order_description: params.orderDescription,
      ipn_callback_url: params.ipnCallbackUrl,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NOWPayments payment failed (${res.status}): ${body.slice(0, 240)}`);
  }

  const data = (await res.json()) as {
    payment_id?: string | number;
    pay_address?: string;
    pay_amount?: number;
    pay_currency?: string;
    payment_status?: string;
    invoice_url?: string;
    pay_url?: string;
  };

  const paymentId = data.payment_id != null ? String(data.payment_id) : "";
  const depositAddress = data.pay_address?.trim() ?? "";

  if (!paymentId || !depositAddress) {
    throw new Error("NOWPayments returned an incomplete payment payload");
  }

  const catalogPay = resolveCatalogPayAmount(params.amountUsdt, payCurrency);

  return {
    paymentId,
    depositAddress,
    payAmount: stableUsdt
      ? catalogPay
      : Number(data.pay_amount ?? params.amountUsdt),
    payCurrency: (data.pay_currency as CryptoPayCurrency) ?? payCurrency,
    status: data.payment_status ?? "waiting",
    invoiceUrl: data.invoice_url?.trim() || undefined,
    payUrl: data.pay_url?.trim() || undefined,
  };
}

/** Poll NOWPayments for the latest payment status. */
export async function fetchNowPaymentStatus(paymentId: string): Promise<string | null> {
  const apiKey = getNowPaymentsApiKey();
  if (!apiKey) return null;

  const res = await fetch(`${NOWPAYMENTS_API}/payment/${paymentId}`, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { payment_status?: string };
  return data.payment_status ?? null;
}

function sortIpnPayload(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortIpnPayload(obj[key]);
  }
  return sorted;
}

/** Verify NOWPayments IPN HMAC-SHA512 signature (x-nowpayments-sig). */
export function verifyNowPaymentsIpnSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET?.trim();
  if (!secret) {
    console.warn("[nowpayments] NOWPAYMENTS_IPN_SECRET unset — rejecting IPN in production");
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader?.trim()) return false;

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const sorted = JSON.stringify(sortIpnPayload(payload));
  const expected = createHmac("sha512", secret).update(sorted).digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signatureHeader.trim(), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return expected === signatureHeader.trim();
  }
}

/** Map NOWPayments status strings → crypto_deposits.status */
export function mapNowPaymentStatus(raw: string): "pending" | "confirming" | "confirmed" | "expired" | "failed" {
  const s = raw.toLowerCase();
  if (["finished", "confirmed", "sent"].includes(s)) return "confirmed";
  if (["confirming", "partially_paid"].includes(s)) return "confirming";
  if (["expired"].includes(s)) return "expired";
  if (["failed", "refunded"].includes(s)) return "failed";
  return "pending";
}

type CryptoDepositGrantRow = {
  id: string;
  user_id: string;
  status: string;
  deposit_type?: string | null;
  plan_id?: string | null;
  credit_amount?: number | null;
  amount_usdt?: number | null;
  credits_granted?: boolean | null;
};

/**
 * Application-level grant when crypto_deposits → confirmed.
 * Subscription → plan row only. Credit pack → wallet increment only.
 * Idempotent via credits_granted (mirrors DB trigger in 20260616 migration).
 */
export async function grantConfirmedCryptoDeposit(
  admin: SupabaseClient,
  depositId: string,
): Promise<{ ok: true; granted?: boolean } | { ok: false; error: string }> {
  const { data: row, error: fetchErr } = await admin
    .from("crypto_deposits")
    .select(
      "id, user_id, status, deposit_type, plan_id, credit_amount, amount_usdt, credits_granted",
    )
    .eq("id", depositId)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }
  if (!row) {
    return { ok: false, error: "Deposit not found" };
  }

  const deposit = row as CryptoDepositGrantRow;
  if (deposit.status !== "confirmed") {
    return { ok: true };
  }
  if (deposit.credits_granted) {
    return { ok: true, granted: false };
  }

  const depositType = deposit.deposit_type ?? "subscription";

  if (depositType === "credit_pack") {
    const amount = Number(deposit.amount_usdt ?? 0);
    if (amount <= 0) {
      return { ok: false, error: "Invalid credit pack amount" };
    }
    const { error: walletErr } = await admin.rpc("increment_wallet", {
      p_user_id: deposit.user_id,
      p_amount: amount,
    });
    if (walletErr) {
      return { ok: false, error: walletErr.message };
    }
  } else {
    const planId = (deposit.plan_id === "enterprise" ? "enterprise" : "startup") as PlanId;
    const { error: subErr } = await admin.from("subscriptions").upsert(
      {
        user_id: deposit.user_id,
        plan: planId,
        status: "active",
        scans_used_this_period: 0,
        period_starts_at: new Date().toISOString(),
        period_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (subErr) {
      return { ok: false, error: subErr.message };
    }
  }

  const { error: flagErr } = await admin
    .from("crypto_deposits")
    .update({ credits_granted: true, confirmed_at: new Date().toISOString() })
    .eq("id", deposit.id);

  if (flagErr) {
    return { ok: false, error: flagErr.message };
  }

  return { ok: true, granted: true };
}
