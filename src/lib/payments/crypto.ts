import "server-only";

import { getCreditPack, getPlanMeta, type PlanId } from "@/lib/plans";

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

/** Lime-on-obsidian QR for terminal checkout. */
export function buildCryptoQrCodeUrl(depositAddress: string, amountUsdt?: number): string {
  const payload =
    amountUsdt != null && amountUsdt > 0
      ? `${depositAddress}?amount=${amountUsdt}`
      : depositAddress;
  const params = new URLSearchParams({
    size: "240x240",
    color: "84ff00",
    bgcolor: "0a0a0a",
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

  const res = await fetch(`${NOWPAYMENTS_API}/payment`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: params.amountUsdt,
      price_currency: "usd",
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
  };

  const paymentId = data.payment_id != null ? String(data.payment_id) : "";
  const depositAddress = data.pay_address?.trim() ?? "";

  if (!paymentId || !depositAddress) {
    throw new Error("NOWPayments returned an incomplete payment payload");
  }

  return {
    paymentId,
    depositAddress,
    payAmount: Number(data.pay_amount ?? params.amountUsdt),
    payCurrency: (data.pay_currency as CryptoPayCurrency) ?? payCurrency,
    status: data.payment_status ?? "waiting",
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

/** Map NOWPayments status strings → crypto_deposits.status */
export function mapNowPaymentStatus(raw: string): "pending" | "confirming" | "confirmed" | "expired" | "failed" {
  const s = raw.toLowerCase();
  if (["finished", "confirmed", "sent"].includes(s)) return "confirmed";
  if (["confirming", "partially_paid"].includes(s)) return "confirming";
  if (["expired"].includes(s)) return "expired";
  if (["failed", "refunded"].includes(s)) return "failed";
  return "pending";
}
