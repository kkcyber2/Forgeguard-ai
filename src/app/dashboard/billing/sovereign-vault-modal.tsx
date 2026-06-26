"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Loader2, Smartphone, Terminal, Wallet, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanMeta } from "@/lib/plans";
import {
  formatCryptoPayAmount,
  isUsdtStableCoin,
  USDT_TRC20_CONTRACT,
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
  /** Show NOWPayments payment_id footer for operator / dev lookup. */
  showOperatorDebug?: boolean;
}

export function SovereignVaultModal({
  open,
  plan,
  onClose,
  onConfirmed,
  revenueSimulation = false,
  onSimulate,
  depositKind = "subscription",
  showOperatorDebug = false,
}: SovereignVaultModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [autoPolling, setAutoPolling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [depositId, setDepositId] = React.useState<string | null>(null);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);
  const [depositStatus, setDepositStatus] = React.useState<"pending" | "confirming" | "confirmed">("pending");
  const [depositAddress, setDepositAddress] = React.useState<string | null>(null);
  const [checkoutQrCode, setCheckoutQrCode] = React.useState<string | null>(null);
  const [walletQrCode, setWalletQrCode] = React.useState<string | null>(null);
  const [qrMode, setQrMode] = React.useState<"checkout" | "wallet">("checkout");
  const [amountUsdt, setAmountUsdt] = React.useState<number>(plan.price);
  const [payCurrency, setPayCurrency] = React.useState("USDT");
  const [payAmount, setPayAmount] = React.useState<number>(plan.price);
  const [paymentUri, setPaymentUri] = React.useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = React.useState<string | null>(null);
  const [payUrl, setPayUrl] = React.useState<string | null>(null);
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
    setPaymentId(null);
    setDepositStatus("pending");
    setAutoPolling(false);
    setDepositAddress(null);
    setCheckoutQrCode(null);
    setWalletQrCode(null);
    setQrMode("checkout");
    setPayUrl(null);
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
      setPaymentId(result.paymentId);
      setDepositAddress(result.depositAddress);
      setCheckoutQrCode(result.checkoutQrCode);
      setWalletQrCode(result.walletQrCode);
      setQrMode(result.payUrl || result.invoiceUrl ? "checkout" : "wallet");
      setAmountUsdt(result.amountUsdt);
      setPayAmount(result.payAmount);
      setPayCurrency(String(result.payCurrency ?? "USDT").toUpperCase());
      setPaymentUri(result.paymentUri);
      setPayUrl(result.payUrl ?? null);
      setInvoiceUrl(result.invoiceUrl ?? result.payUrl ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, plan.name, plan.price, revenueSimulation, depositKind]);

  const pollDeposit = React.useCallback(
    async (silent = false) => {
      if (revenueSimulation && onSimulate) {
        if (!silent) {
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
        }
        return;
      }

      if (!depositId || depositStatus === "confirmed") return;

      if (!silent) {
        setVerifying(true);
        setError(null);
        setVerifyMsg(null);
      } else {
        setAutoPolling(true);
      }

      try {
        const result = await verifyCryptoDeposit(depositId);
        if (!result.ok) {
          if (!silent) setError(result.error);
          return;
        }
        if (result.status === "confirmed") {
          setDepositStatus("confirmed");
          onConfirmed();
          return;
        }
        if (result.status === "confirming") {
          setDepositStatus("confirming");
        }
        setVerifyMsg(result.message);
      } finally {
        if (!silent) setVerifying(false);
        else setAutoPolling(false);
      }
    },
    [depositId, depositStatus, onConfirmed, onSimulate, revenueSimulation],
  );

  React.useEffect(() => {
    if (!open || revenueSimulation || !depositId || depositStatus === "confirmed") {
      return;
    }
    const timer = window.setInterval(() => {
      void pollDeposit(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [open, revenueSimulation, depositId, depositStatus, pollDeposit]);

  async function handleVerify() {
    await pollDeposit(false);
  }

  async function copyAddress() {
    if (!depositAddress) return;
    await navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const checkoutLink = payUrl ?? invoiceUrl;
  const activeQr = qrMode === "checkout" && checkoutQrCode ? checkoutQrCode : walletQrCode;
  const isTrc20 = payCurrency.includes("TRC") || payCurrency === "USDTTRC20";
  const showDebugFooter = showOperatorDebug || process.env.NODE_ENV === "development";

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

              {!revenueSimulation && activeQr && (
                <div className="space-y-4">
                  {checkoutLink && (
                    <div className="flex gap-1 rounded-sm border border-lime-500/15 bg-[#0a0a0a] p-1">
                      <button
                        type="button"
                        onClick={() => setQrMode("checkout")}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-2 text-[9px] uppercase tracking-[0.14em] transition-colors",
                          qrMode === "checkout"
                            ? "bg-lime-500/15 text-lime-400"
                            : "text-zinc-500 hover:text-zinc-300",
                        )}
                      >
                        <Smartphone size={11} />
                        Crypto app
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrMode("wallet")}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-2 text-[9px] uppercase tracking-[0.14em] transition-colors",
                          qrMode === "wallet"
                            ? "bg-lime-500/15 text-lime-400"
                            : "text-zinc-500 hover:text-zinc-300",
                        )}
                      >
                        <Wallet size={11} />
                        Send from wallet
                      </button>
                    </div>
                  )}

                  <div className="rounded-sm border border-lime-500/10 bg-lime-500/5 px-3 py-2.5 text-[10px] leading-relaxed text-zinc-400">
                    {qrMode === "checkout" && checkoutLink ? (
                      <>
                        <strong className="text-lime-400">Recommended:</strong> Scan the QR or open the
                        checkout page — NOWPayments handles network, amount, and confirmation. Works
                        with Bybit, Trust Wallet, and exchange apps.
                      </>
                    ) : (
                      <>
                        <strong className="text-lime-400">Manual send:</strong> Open TronLink or Trust
                        Wallet via <span className="text-lime-400/90">Open in wallet</span> below.
                        Network: <span className="text-lime-400/90">TRON (TRC20)</span>, token{" "}
                        <span className="text-lime-400/90">USDT</span>, contract{" "}
                        <span className="break-all font-mono text-[9px] text-zinc-500">
                          {USDT_TRC20_CONTRACT}
                        </span>
                        . Send exactly{" "}
                        <span className="text-lime-400">
                          {formatCryptoPayAmount(payAmount, payCurrency)} USDT
                        </span>
                        .
                      </>
                    )}
                  </div>

                  {qrMode === "wallet" && isTrc20 && (
                    <div className="rounded-sm border border-zinc-700/50 bg-zinc-900/40 px-3 py-2.5 text-[10px] leading-relaxed text-zinc-400">
                      <strong className="text-zinc-300">Bybit:</strong> Assets → Withdraw → USDT →
                      Network <span className="text-lime-400/90">TRC20</span> → paste address below →
                      amount{" "}
                      <span className="text-lime-400">
                        {formatCryptoPayAmount(payAmount, payCurrency)} USDT
                      </span>
                      . Exchanges cannot scan tron: QR — copy the address manually.
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                    <div className="shrink-0 overflow-hidden rounded-sm border border-white/15 bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeQr}
                        alt={qrMode === "checkout" ? "Checkout QR code" : "Wallet send QR code"}
                        width={160}
                        height={160}
                        className="block"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      {qrMode === "checkout" && checkoutLink ? (
                        <>
                          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">
                            NOWPayments checkout
                          </p>
                          <a
                            href={checkoutLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-sm border border-lime-500/40 bg-lime-500/10 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-lime-400 transition-colors hover:bg-lime-500/20"
                          >
                            <ExternalLink size={12} />
                            Open checkout page
                          </a>
                        </>
                      ) : (
                        <>
                          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">
                            TRC20 deposit address
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
                          {paymentUri && isTrc20 && (
                            <div className="mt-3 flex flex-col gap-1.5">
                              <a
                                href={paymentUri}
                                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-lime-400/90 underline-offset-2 hover:underline"
                              >
                                <Wallet size={10} />
                                Open in TronLink
                              </a>
                              <a
                                href={paymentUri}
                                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-lime-400/90 underline-offset-2 hover:underline"
                              >
                                <Wallet size={10} />
                                Open in Trust Wallet
                              </a>
                            </div>
                          )}
                        </>
                      )}
                    </div>
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
                  {autoPolling && (
                    <span className="mt-1 block text-zinc-500">Auto-checking every 15s…</span>
                  )}
                </div>
              )}

              {depositStatus === "confirming" && !verifyMsg && (
                <div className="rounded-sm border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[10px] text-amber-300/90">
                  Transaction detected — awaiting blockchain confirmations…
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

              {showDebugFooter && paymentId && (
                <p className="border-t border-white/[0.04] pt-3 text-center font-mono text-[9px] text-zinc-600">
                  NOWPayments payment_id:{" "}
                  <span className="select-all text-zinc-500">{paymentId}</span>
                  {depositId && (
                    <>
                      {" · "}deposit:{" "}
                      <span className="select-all text-zinc-600">{depositId.slice(0, 8)}…</span>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
