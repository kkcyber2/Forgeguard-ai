"use client";

/**
 * /dashboard/missions/new — Post a new security mission (Clients only)
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Crosshair } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { TrustTagBadge } from "@/components/trust/trust-tag-badge";
import { createMission } from "@/lib/trust/mission-actions";
import {
  resolveVerifiedCompanyTag,
  validateSelfTypedCompanyTag,
} from "@/lib/trust/identity";

const RANKS = ["RECRUIT", "OPERATIVE", "ELITE", "SOVEREIGN"] as const;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export default function NewMissionPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [profileTrust, setProfileTrust] = useState<{
    company_tag: string | null;
    domain_verified: boolean;
    company_domain: string | null;
  } | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    scope: "",
    budget_credits: "",
    required_rank: "OPERATIVE" as string,
    company_tag: "",
  });

  useEffect(() => {
    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("company_tag, domain_verified, company_domain")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfileTrust({
          company_tag: data.company_tag,
          domain_verified: Boolean(data.domain_verified),
          company_domain: data.company_domain,
        });
      }
    });
  }, []);

  const verifiedTag = profileTrust
    ? resolveVerifiedCompanyTag(profileTrust)
    : null;

  const tagPreview = form.company_tag.trim()
    ? validateSelfTypedCompanyTag(form.company_tag, profileTrust ?? {})
    : null;

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

    if (form.company_tag.trim() && tagPreview && !tagPreview.ok) {
      setError(tagPreview.error);
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await createMission({
        title: form.title.trim(),
        description: form.description.trim(),
        scope: form.scope.trim() || undefined,
        budgetCredits: parseInt(form.budget_credits, 10) || 0,
        requiredRank: form.required_rank,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
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
      <Link
        href="/dashboard/missions"
        className="mb-6 flex items-center gap-2 text-xs transition-opacity hover:opacity-70"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        <ArrowLeft size={13} strokeWidth={1.5} />
        Mission Vault
      </Link>

      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Crosshair size={16} style={{ color: "#D1FF00" }} strokeWidth={1.5} />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "#D1FF00" }}>
            Post Security Mission
          </p>
        </div>
        <h1 className="text-2xl font-semibold text-white">New Contract</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          Define the scope, budget, and operator requirements. Company badges appear only after DNS domain verification.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          className="rounded-[4px] p-6"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
            border: "0.5px solid rgba(255,255,255,0.09)",
          }}
        >
          <div className="flex flex-col gap-5">
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

            <Field
              label="Company Tag"
              hint={verifiedTag ? "Verified from your domain" : "DNS verification required"}
            >
              {verifiedTag ? (
                <div className="mt-1">
                  <TrustTagBadge tag={verifiedTag} tier="domain" verified />
                  <p className="mt-2 text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    This verified tag will appear on your mission automatically.
                  </p>
                </div>
              ) : (
                <>
                  <input
                    name="company_tag"
                    type="text"
                    value={form.company_tag}
                    onChange={handleChange}
                    placeholder="ACME SEC (preview only until DNS verified)"
                    maxLength={24}
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(209,255,0,0.35)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  />
                  {form.company_tag.trim() ? (
                    <div className="mt-2">
                      {tagPreview && !tagPreview.ok ? (
                        <TrustTagBadge
                          unverifiedPreview={tagPreview.previewUnverified ?? form.company_tag}
                          verified={false}
                        />
                      ) : null}
                      <p className="mt-1.5 text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Self-typed tags are not saved. Verify your domain in Settings to publish a badge.
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </Field>

            {error && (
              <p className="text-xs" style={{ color: "rgba(255,100,100,0.85)" }}>{error}</p>
            )}

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
