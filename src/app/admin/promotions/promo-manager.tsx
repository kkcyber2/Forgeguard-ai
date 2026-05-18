"use client";

import * as React from "react";
import {
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createPromoCode, revokePromoCode } from "./actions";

type PromoRow = {
  id: string;
  code: string;
  target_plan: string;
  uses_left: number;
  expires_at: string | null;
  created_at: string;
};

interface PromoManagerProps {
  promos: PromoRow[];
}

type ToastState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

export function PromoManager({ promos: initialPromos }: PromoManagerProps) {
  const [promos, setPromos] = React.useState(initialPromos);
  const [showForm, setShowForm] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [code, setCode] = React.useState("");
  const [plan, setPlan] = React.useState<"startup" | "enterprise">("startup");
  const [uses, setUses] = React.useState(1);
  const [expires, setExpires] = React.useState("");

  function showToast(t: ToastState) {
    setToast(t);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 5000);
  }

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("code", code);
      fd.append("target_plan", plan);
      fd.append("uses_left", String(uses));
      if (expires) fd.append("expires_at", expires);
      const result = await createPromoCode(fd);
      if (result.ok) {
        showToast({ type: "success", message: `Code "${result.code}" created.` });
        setCode("");
        setUses(1);
        setExpires("");
        setShowForm(false);
        // Optimistically add — server revalidates the page on next load
        setPromos((prev) => [
          {
            id: crypto.randomUUID(),
            code: result.code,
            target_plan: plan,
            uses_left: uses,
            expires_at: expires || null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        showToast({ type: "error", message: result.error });
      }
    } catch {
      showToast({ type: "error", message: "Unexpected error — try again." });
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke(promoId: string, promoCode: string) {
    const fd = new FormData();
    fd.append("promo_id", promoId);
    await revokePromoCode(fd);
    setPromos((prev) =>
      prev.map((p) => (p.id === promoId ? { ...p, uses_left: 0 } : p)),
    );
    showToast({ type: "success", message: `"${promoCode}" revoked.` });
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={12} className="text-foreground-subtle" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-foreground-subtle">
            Active Codes
          </span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5",
            "font-mono text-[10px] font-semibold transition-all",
            showForm
              ? "border-white/[0.1] text-foreground-muted"
              : "border-acid/50 bg-acid/10 text-acid hover:bg-acid/20",
          )}
        >
          <Plus size={10} />
          {showForm ? "Cancel" : "New code"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-sm border border-acid/20 bg-acid/5 p-4 space-y-3"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-acid">
            Create promo code
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Code */}
            <div>
              <label className="mb-1 block font-mono text-[10px] text-foreground-subtle">
                Code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                placeholder="FG-ENT-ALPHA"
                maxLength={32}
                required
                className={cn(
                  "w-full rounded-sm border bg-obsidian-800/70 px-3 py-2",
                  "font-mono text-xs tracking-widest text-foreground",
                  "border-white/[0.08] focus:border-acid/60 focus:outline-none focus:ring-1 focus:ring-acid/30",
                )}
              />
            </div>

            {/* Plan */}
            <div>
              <label className="mb-1 block font-mono text-[10px] text-foreground-subtle">
                Plan
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["startup", "enterprise"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={cn(
                      "rounded-sm border px-2 py-2 font-mono text-[10px] capitalize transition-all",
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

            {/* Uses */}
            <div>
              <label className="mb-1 block font-mono text-[10px] text-foreground-subtle">
                Max uses
              </label>
              <input
                type="number"
                min={1}
                max={9999}
                value={uses}
                onChange={(e) => setUses(Number(e.target.value))}
                className={cn(
                  "w-full rounded-sm border bg-obsidian-800/70 px-3 py-2",
                  "font-mono text-xs text-foreground",
                  "border-white/[0.08] focus:border-acid/60 focus:outline-none focus:ring-1 focus:ring-acid/30",
                )}
              />
            </div>

            {/* Expires */}
            <div>
              <label className="mb-1 block font-mono text-[10px] text-foreground-subtle">
                Expires (optional)
              </label>
              <input
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className={cn(
                  "w-full rounded-sm border bg-obsidian-800/70 px-3 py-2",
                  "font-mono text-xs text-foreground",
                  "border-white/[0.08] focus:border-acid/60 focus:outline-none focus:ring-1 focus:ring-acid/30",
                )}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || !code.trim()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm border px-4 py-2",
              "font-mono text-xs font-semibold transition-all",
              "border-acid/50 bg-acid/10 text-acid hover:bg-acid/20",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {pending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Plus size={11} />
            )}
            Create code
          </button>
        </form>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-sm border px-3 py-2 text-xs",
            toast.type === "success"
              ? "border-acid/30 bg-acid/10 text-acid"
              : "border-red-500/30 bg-red-500/10 text-red-400",
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

      {/* Codes table */}
      {promos.length === 0 ? (
        <div className="rounded-sm border border-dashed border-white/[0.08] py-10 text-center">
          <Tag size={20} className="mx-auto mb-2 text-foreground-subtle/40" />
          <p className="text-xs text-foreground-subtle">No promo codes yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-white/[0.06]">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="border-b border-white/[0.04] text-left">
                {["Code", "Plan", "Uses left", "Expires", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    "border-b border-white/[0.03] transition-colors hover:bg-white/[0.015]",
                    p.uses_left === 0 && "opacity-40",
                  )}
                >
                  <td className="px-4 py-3 font-mono font-semibold tracking-widest text-foreground">
                    {p.code}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded border px-2 py-0.5 font-mono text-[10px] uppercase",
                        p.target_plan === "enterprise"
                          ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
                          : "border-acid/30 bg-acid/10 text-acid",
                      )}
                    >
                      {p.target_plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground-muted">
                    {p.uses_left === 0 ? (
                      <span className="text-red-400">Exhausted</span>
                    ) : (
                      p.uses_left
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground-muted">
                    {p.expires_at
                      ? new Date(p.expires_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    {p.uses_left > 0 && (
                      <button
                        onClick={() => handleRevoke(p.id, p.code)}
                        className="inline-flex items-center gap-1 rounded border border-red-500/20 bg-red-500/5 px-2 py-1 font-mono text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <Ban size={9} />
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
