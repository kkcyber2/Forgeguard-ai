"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ShieldCheck } from "lucide-react";

/** Step-up MFA challenge for Citadel / Admin gated routes. */
export default function MfaChallengePage() {
  const supabase = createClient();
  const [code, setCode] = React.useState("");
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [verifying, setVerifying] = React.useState(false);

  const next =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next") ?? "/dashboard"
      : "/dashboard";

  React.useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        window.location.href = `/dashboard/settings#mfa?require=enroll&next=${encodeURIComponent(next)}`;
        return;
      }
      setFactorId(totp.id);
      setLoading(false);
    })();
  }, [supabase, next]);

  async function verify() {
    if (!factorId || code.length < 6) return;
    setVerifying(true);
    setError(null);
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !challenge) {
      setError(chErr?.message ?? "Challenge failed");
      setVerifying(false);
      return;
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setVerifying(false);
    if (verErr) {
      setError(verErr.message);
      return;
    }
    window.location.href = next;
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-foreground-subtle" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-sm border border-white/[0.08] bg-surface p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-acid" />
          <h1 className="text-lg font-semibold">Verify identity</h1>
        </div>
        <p className="mt-2 text-sm text-foreground-muted">
          Enter your authenticator code to access this compartment.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="mt-4 w-full rounded-sm border border-white/10 bg-black/30 px-4 py-3 text-center font-mono text-lg tracking-[0.3em]"
          autoFocus
        />
        <button
          type="button"
          disabled={verifying || code.length < 6}
          onClick={() => void verify()}
          className="mt-4 w-full rounded-sm border border-acid/30 bg-acid/10 py-3 text-xs uppercase tracking-wider text-acid disabled:opacity-40"
        >
          {verifying ? "Verifying…" : "Continue"}
        </button>
        {error && <p className="mt-3 font-mono text-[10px] text-threat">{error}</p>}
      </div>
    </div>
  );
}
