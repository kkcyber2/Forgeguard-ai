"use client";

import * as React from "react";
import { X, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { overrideSubscription } from "./actions";

interface OverrideDialogProps {
  userId: string;
  userEmail: string;
  currentPlan: string;
}

export function OverrideDialog({
  userId,
  userEmail,
  currentPlan,
}: OverrideDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [plan, setPlan] = React.useState<"free" | "startup" | "enterprise">(
    currentPlan as "free" | "startup" | "enterprise",
  );
  const [days, setDays] = React.useState(30);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("user_id", userId);
      fd.append("plan", plan);
      fd.append("days", String(days));
      const res = await overrideSubscription(fd);
      setResult(res);
      if (res.ok) {
        setTimeout(() => {
          setOpen(false);
          setResult(null);
        }, 1800);
      }
    } catch {
      setResult({ ok: false, message: "Something went wrong." });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => {
          setOpen(true);
          setResult(null);
          setPlan(currentPlan as "free" | "startup" | "enterprise");
          setDays(30);
        }}
        className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-foreground-muted transition-colors hover:border-acid/40 hover:text-acid"
      >
        Override
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          {/* Panel */}
          <div className="relative w-full max-w-sm rounded-sm border border-white/[0.1] bg-[#0a0a0a] p-6 shadow-2xl">
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-foreground-subtle transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck size={12} className="text-acid" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-acid">
                Admin Override
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              Override subscription
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-foreground-subtle">
              {userEmail}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Plan selector */}
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-foreground-subtle">
                  Plan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["free", "startup", "enterprise"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlan(p)}
                      className={cn(
                        "rounded-sm border px-2 py-1.5 font-mono text-[10px] capitalize transition-all",
                        plan === p
                          ? "border-acid/60 bg-acid/10 text-acid"
                          : "border-white/[0.08] text-foreground-muted hover:border-white/[0.15]",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-foreground-subtle">
                  Duration (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className={cn(
                    "w-full rounded-sm border bg-obsidian-800/70 px-3 py-2",
                    "font-mono text-sm text-foreground",
                    "border-white/[0.08] focus:border-acid/60 focus:outline-none focus:ring-1 focus:ring-acid/30",
                  )}
                />
              </div>

              {/* Result feedback */}
              {result && (
                <div
                  className={cn(
                    "rounded-sm border px-3 py-2 text-[11px]",
                    result.ok
                      ? "border-acid/30 bg-acid/10 text-acid"
                      : "border-red-500/30 bg-red-500/10 text-red-400",
                  )}
                >
                  {result.message}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                className={cn(
                  "w-full rounded-sm border px-4 py-2",
                  "font-mono text-xs font-semibold transition-all",
                  "border-acid/50 bg-acid/10 text-acid",
                  "hover:bg-acid/20 hover:border-acid/70",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "focus:outline-none focus:ring-1 focus:ring-acid/40",
                )}
              >
                {pending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={11} className="animate-spin" />
                    Applying...
                  </span>
                ) : (
                  "Apply Override"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
