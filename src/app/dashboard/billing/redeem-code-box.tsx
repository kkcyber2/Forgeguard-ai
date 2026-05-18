"use client";

import * as React from "react";
import { Gift, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { redeemCode } from "./redeem-action";

type ToastState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

export function RedeemCodeBox() {
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(t: ToastState) {
    setToast(t);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 5000);
  }

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || pending) return;
    setPending(true);
    try {
      const result = await redeemCode(code);
      if (result.ok) {
        showToast({ type: "success", message: result.message });
        setCode("");
      } else {
        showToast({ type: "error", message: result.error });
      }
    } catch {
      showToast({ type: "error", message: "Something went wrong. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-6 rounded-sm border border-white/[0.06] bg-surface p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Gift size={12} strokeWidth={1.75} className="text-foreground-subtle" />
        <span className="text-eyebrow text-foreground-subtle">Promo code</span>
      </div>

      <p className="mb-3 text-xs text-foreground-muted">
        Have a founder pass or promo code? Redeem it below for instant plan access.
      </p>

      {/* Input row */}
      <form onSubmit={handleRedeem} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="FG-ENT-ALPHA"
          maxLength={32}
          spellCheck={false}
          autoComplete="off"
          disabled={pending}
          className={cn(
            "flex-1 rounded-sm border bg-obsidian-800/70 px-3 py-2",
            "font-mono text-sm tracking-widest text-foreground",
            "placeholder:text-foreground-subtle placeholder:tracking-normal",
            "border-white/[0.08] transition-colors duration-150",
            "focus:border-acid/60 focus:outline-none focus:ring-1 focus:ring-acid/30",
            "disabled:opacity-50",
          )}
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm border px-4 py-2",
            "text-xs font-semibold transition-all duration-150",
            "border-acid/50 bg-acid/10 text-acid",
            "hover:bg-acid/20 hover:border-acid/70",
            "disabled:cursor-not-allowed disabled:opacity-40",
            "focus:outline-none focus:ring-1 focus:ring-acid/40",
          )}
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            "Redeem"
          )}
        </button>
      </form>

      {/* Inline toast */}
      {toast && (
        <div
          className={cn(
            "mt-3 flex items-start gap-2 rounded-sm border px-3 py-2 text-xs",
            toast.type === "success"
              ? "border-acid/30 bg-acid/10 text-acid"
              : "border-threat/40 bg-threat/10 text-threat",
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={12} className="mt-[2px] shrink-0" />
          ) : (
            <XCircle size={12} className="mt-[2px] shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
