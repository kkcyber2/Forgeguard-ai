"use client";

/**
 * /dashboard/missions/new — Post a new security mission (Clients only)
 * ─────────────────────────────────────────────────────────────────────
 * Sovereign OS aesthetic: Obsidian / Acid Green / Glassmorphism.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Crosshair } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const RANKS = ["RECRUIT", "OPERATIVE", "ELITE", "SOVEREIGN"] as const;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export default function NewMissionPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    scope: "",
    budget_credits: "",
    required_rank: "OPERATIVE" as string,
    company_tag: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not authenticated."); return; }

      const { error: dbErr } = await supabase.from("missions").insert({
        client_id: user.id,
        title: form.title.trim(),
        description: form.description.trim(),
        scope: form.scope.trim() || null,
        budget_credits: parseInt(form.budget_credits, 10) || 0,
        required_rank: form.required_rank,
        company_tag: form.company_tag.trim().toUpperCase() || null,
      });

      if (dbErr) { setError(dbErr.message); return; }
      router.push("/dashboard/missions");
    });
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(0,0,0,0.35)",
    border: "0.5px solid rgba(255,255,255,0.08)",
    borderRadius: 3,
    color: "rgba(255,255,255,0.75)",
    outline: "none",
    width: "100%",
    padding: "8px 12px",
    fontSize: 13,
  };

  return (
    <div className="mx-auto max-w-2xl pb-16">
      {/* Back */}
      <Link
        href="/dashboard/missions"
        className="mb-6 flex items-center gap-2 text-xs transition-opacity hover:opacity-70"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        <ArrowLeft size={13} strokeWidth={1.5} />
        Mission Vault
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Crosshair size={16} style={{ color: "#D1FF00" }} strokeWidth={1.5} />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "#D1FF00" }}>
            Post Security Mission
          </p>
        </div>
        <h1 className="text-2xl font-semibold text-white">New Contract</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          Define the scope, budget, and operator requirements. Verified hackers will pitch within 24 hours.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div
          className="rounded-[4px] p-6"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
            border: "0.5px solid rgba(255,255,255,0.09)",
          }}
        >
          <div className="flex flex-col gap-5">
            {/* Title */}
            <Field label="Mission Title">
              <input
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Pentest our payment flow — PCI scope"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(209,255,0,0.35)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </Field>

            {/* Description */}
            <Field label="Mission Brief">
              <textarea
                name="description"
                rows={4}
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the goal, context, and what a successful outcome looks like..."
                style={{ ...inputStyle, resize: "none" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(209,255,0,0.35)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </Field>

            {/* Scope */}
            <Field label="Scope / Rules of Engagement" hint="Optional">
              <textarea
                name="scope"
                rows={3}
                value={form.scope}
                onChange={handleChange}
                placeholder="IP ranges, domains, excluded systems, legal authorization notes..."
                style={{ ...inputStyle, resize: "none" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(209,255,0,0.35)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </Field>

            {/* Budget + Rank */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Budget (credits)">
                <input
                  name="budget_credits"
                  type="number"
                  min={0}
                  value={form.budget_credits}
                  onChange={handleChange}
                  placeholder="5000"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(209,255,0,0.35)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                />
              </Field>

              <Field label="Minimum Rank">
                <select
                  name="required_rank"
                  value={form.required_rank}
                  onChange={handleChange}
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    cursor: "pointer",
                  }}
                >
                  {RANKS.map((r) => (
                    <option key={r} value={r} style={{ background: "#0a0a0a" }}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Company tag */}
            <Field label="Company Tag" hint="e.g. STRIPE SEC — displayed as badge on the mission">
              <input
                name="company_tag"
                type="text"
                value={form.company_tag}
                onChange={handleChange}
                placeholder="ACME SEC"
                maxLength={24}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(209,255,0,0.35)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
              {form.company_tag && (
                <span
                  className="mt-1.5 flex w-fit items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-[3px]"
                  style={{
                    background: "rgba(56,189,248,0.1)",
                    border: "0.5px solid rgba(56,189,248,0.3)",
                    color: "#38BDF8",
                  }}
                >
                  [{form.company_tag.toUpperCase()}]
                </span>
              )}
            </Field>

            {error && (
              <p className="text-xs" style={{ color: "rgba(255,100,100,0.85)" }}>{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center justify-center gap-2 rounded-[3px] py-2.5 font-mono text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-150 disabled:opacity-50"
              style={{ background: "#D1FF00", color: "#050505" }}
            >
              {isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Crosshair size={14} strokeWidth={1.75} />
              )}
              {isPending ? "Deploying Mission…" : "Post Mission"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.35)" }}>
          {label}
        </label>
        {hint && (
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
