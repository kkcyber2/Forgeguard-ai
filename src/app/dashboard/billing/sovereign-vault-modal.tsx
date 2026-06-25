"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Copy, Loader2, Terminal, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanMeta } from "@/lib/plans";
import {
  formatCryptoPayAmount,
  isUsdtStableCoin,
} from "@/lib/payments/crypto-format";
import { generateDepositAddress, generateCreditPackDeposit, verifyCryptoDeposit } from "./crypto-actions";

export interface SovereignVaultModalProps {
  open: boolean;
  plan: PlanMeta;
  onClose: () => void;
  onConfirmed: () => void;
  revenueSimulation?: boolean;
  onSimulate?: () => Promise<void>;
  /** Subscription plans vs Bazaar credit pack top-ups. */
  depositKind?: "subscription" | "credit_pack";
}

export function SovereignVaultModal({
  open,
  plan,
  onClose,
  onConfirmed,
  revenueSimulation = false,
  onSimulate,
  depositKind = "subscription",
}: SovereignVaultModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [depositId, setDepositId] = React.useState<string | null>(null);
  const [depositAddress, setDepositAddress] = React.useState<string | null>(null);
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [amountUsdt, setAmountUsdt] = React.useState<number>(plan.price);
  const [payCurrency, setPayCurrency] = React.useState("USDT");
  const [payAmount, setPayAmount] = React.useState<number>(plan.price);
  const [paymentUri, setPaymentUri] = React.useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = React.useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [addressPrefix, setAddressPrefix] = React.useState("");
  const [addressSuffix, setAddressSuffix] = React.useState("");

  const addressCheckRequired = Boolean(depositAddress && !revenueSimulation);
  const addressConfirmed =
    !addressCheckRequired ||
    (depositAddress!.slice(0, 6) === addressPrefix.trim() &&
      depositAddress!.slice(-6) === addressSuffix.trim());

  React.useEffect(() => {
    if (!open || revenueSimulation) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setVerifyMsg(null);
    setDepositId(null);
    setDepositAddress(null);
    setQrCode(null);
    setAmountUsdt(plan.price);
    setAddressPrefix("");
    setAddressSuffix("");

    void (depositKind === "credit_pack"
      ? generateCreditPackDeposit(plan.name)
      : generateDepositAddress(plan.name)
    ).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDepositId(result.depositId);
      setDepositAddress(result.depositAddress);
      setQrCode(result.qrCode);
      setAmountUsdt(result.amountUsdt);
      setPayAmount(result.payAmount);
      setPayCurrency(String(result.payCurrency ?? "USDT").toUpperCase());
      setPaymentUri(result.paymentUri);
      setInvoiceUrl(result.invoiceUrl ?? result.payUrl ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, plan.name, plan.price, revenueSimulation, depositKind]);

  async function handleVerify() {
    if (revenueSimulation && onSimulate) {
      setVerifying(true);
      setError(null);
      try {
        await onSimulate();
        onConfirmed();
      } catch {
        setError("Simulation failed");
      } finally {
        setVerifying(false);
      }
      return;
    }

    if (!depositId) return;

    setVerifying(true);
    setError(null);
    setVerifyMsg(null);

    try {
      const result = await verifyCryptoDeposit(depositId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.status === "confirmed") {
        onConfirmed();
        return;
      }
      setVerifyMsg(result.message);
    } finally {
      setVerifying(false);
    }
  }

  async function copyAddress() {
    if (!depositAddress) return;
    await navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.22 }}
        className="relative w-full max-w-lg overflow-hidden rounded-sm border border-lime-500/20 bg-[#050505] shadow-[0_0_48px_rgba(132,255,0,0.06)]"
      >
        <div className="flex items-center gap-2 border-b border-lime-500/10 bg-[#0a0a0a] px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-lime-400/60" />
          </div>
          <div className="ml-2 flex items-center gap-1.5">
            <Terminal size={11} className="text-lime-400/70" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime-400/80">
              Sovereign Vault Deposit
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-zinc-600 transition-colors hover:text-zinc-300"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-6 font-mono">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(132,255,0,0.4) 2px, rgba(132,255,0,0.4) 3px)",
            }}
          />

          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-600">
            {"// ghost_mode.checkout.init"}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-lime-400">
            {plan.name} — {formatCryptoPayAmount(payAmount, payCurrency)} {payCurrency}
          </h2>

          {error && (
            <div className="mt-4 rounded-sm border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
              {error}
            </div>
          )}

          {loading && !revenueSimulation && (
            <div className="mt-8 flex flex-col items-center gap-3 py-8">
              <Loader2 size={20} className="animate-spin text-lime-400/60" />
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">
                Generating vault address...
              </p>
            </div>
          )}

          {(revenueSimulation || (!loading && depositAddress)) && (
            <div className="mt-5 space-y-5">
              <div className="rounded-sm border border-lime-500/15 bg-[#0a0a0a] p-4">
                <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">
                  Send exactly
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-lime-400">
                  {formatCryptoPayAmount(payAmount, payCurrency)}{" "}
                  <span className="text-sm font-normal text-zinc-500">{payCurrency}</span>
                </p>
                {!isUsdtStableCoin(payCurrency) && (
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    ≈ ${amountUsdt.toFixed(2)} USD list price
                  </p>
                )}
                {!revenueSimulation && (
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Network: {payCurrency} — send exact crypto amount to activate
                  </p>
                )}
              </div>

              {!revenueSimulation && qrCode && (
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <div className="shrink-0 overflow-hidden rounded-sm border border-white/15 bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCode}
                      alt="Deposit QR code"
                      width={160}
                      height={160}
                      className="block"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">
                      Deposit Address
                    </p>
                    <p className="mt-1 break-all text-[11px] leading-relaxed text-lime-400/90">
                      {depositAddress}
                    </p>
                    <button
                      type="button"
                      onClick={() => void copyAddress()}
                      className="mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-lime-400"
                    >
                      <Copy size={10} />
                      {copied ? "Copied" : "Copy address"}
                    </button>
                    {paymentUri && (
                      <a
                        href={paymentUri}
                        className="mt-2 block text-[10px] uppercase tracking-widest text-lime-400/80 underline-offset-2 hover:underline"
                      >
                        Open in wallet
                      </a>
                    )}
                    {invoiceUrl && (
                      <a
                        href={invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block text-[10px] uppercase tracking-widest text-zinc-400 underline-offset-2 hover:text-lime-400 hover:underline"
                      >
                        Pay on NOWPayments
                      </a>
                    )}
                  </div>
                </div>
              )}

              {revenueSimulation && (
                <div className="rounded-sm border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[10px] text-amber-300">
                  REVENUE_SIMULATION_MODE — no on-chain payment required
                </div>
              )}

              {!revenueSimulation && depositAddress && (
                <>
                  <div className="rounded-sm border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[10px] leading-relaxed text-amber-200/90">
                    Verify the pasted address matches what you see on screen. Clipboard
                    clipper malware can swap crypto addresses — compare character by character
                    before sending funds.
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">
                        First 6 characters
                      </span>
                      <input
                        type="text"
                        value={addressPrefix}
                        onChange={(e) => setAddressPrefix(e.target.value)}
                        maxLength={6}
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-1 w-full rounded-sm border border-lime-500/15 bg-[#0a0a0a] px-2 py-1.5 font-mono text-[11px] text-lime-400 outline-none focus:border-lime-500/40"
                        placeholder={depositAddress.slice(0, 6)}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">
                        Last 6 characters
                      </span>
                      <input
                        type="text"
                        value={addressSuffix}
                        onChange={(e) => setAddressSuffix(e.target.value)}
                        maxLength={6}
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-1 w-full rounded-sm border border-lime-500/15 bg-[#0a0a0a] px-2 py-1.5 font-mono text-[11px] text-lime-400 outline-none focus:border-lime-500/40"
                        placeholder={depositAddress.slice(-6)}
                      />
                    </label>
                  </div>
                  {!addressConfirmed && (addressPrefix || addressSuffix) && (
                    <p className="text-[10px] text-amber-400/90">
                      Address confirmation mismatch — re-check the deposit address above.
                    </p>
                  )}
                </>
              )}

              {verifyMsg && (
                <div className="rounded-sm border border-lime-500/20 bg-lime-500/5 px-3 py-2 text-[10px] text-lime-400/80">
                  {verifyMsg}
                </div>
              )}

              <button
                type="button"
                disabled={
                  verifying ||
                  (loading && !revenueSimulation) ||
                  (addressCheckRequired && !addressConfirmed)
                }
                onClick={() => void handleVerify()}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-sm border px-4 py-3",
                  "border-lime-500/40 bg-lime-500/10 text-[11px] font-semibold uppercase tracking-[0.18em] text-lime-400",
                  "transition-colors hover:bg-lime-500/20 hover:border-lime-500/60",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                {verifying ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Scanning chain...
                  </>
                ) : (
                  <>
                    <Zap size={12} />
                    I Have Sent Payment
                  </>
                )}
              </button>

              <p className="text-center text-[9px] leading-relaxed text-zinc-700">
                USDT · SOL · BTC accepted via Sovereign Vault · Credits auto-credit on confirmation
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
