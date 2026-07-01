"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, Loader2, ShieldCheck, Copy, Check } from "lucide-react";

type Factor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
};

function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = crypto.getRandomValues(new Uint8Array(4));
    const hex = Array.from(part)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}

async function digestCodes(codes: string[]): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(codes.join("|"));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Supabase Auth TOTP MFA enrollment + recovery codes. */
export function MfaSettings() {
  const supabase = createClient();
  const [factors, setFactors] = React.useState<Factor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [enrolling, setEnrolling] = React.useState(false);
  const [qr, setQr] = React.useState<string | null>(null);
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [verifyCode, setVerifyCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);
  const [copied, setCopied] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const { data, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr) {
      setError(listErr.message);
      setLoading(false);
      return;
    }
    const all = [...(data.totp ?? []), ...(data.phone ?? [])] as Factor[];
    setFactors(all.filter((f) => f.status === "verified"));
    setLoading(false);
  }, [supabase]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startEnroll() {
    setEnrolling(true);
    setError(null);
    const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "ForgeGuard Authenticator",
    });
    if (enrollErr || !data) {
      setError(enrollErr?.message ?? "Enrollment failed");
      setEnrolling(false);
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setEnrolling(false);
  }

  async function confirmEnroll() {
    if (!factorId || verifyCode.length < 6) return;
    setError(null);
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !challenge) {
      setError(chErr?.message ?? "Challenge failed");
      return;
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: verifyCode,
    });
    if (verErr) {
      setError(verErr.message);
      return;
    }
    const codes = generateRecoveryCodes();
    setRecoveryCodes(codes);
    const digest = await digestCodes(codes);
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await (supabase as any)
        .from("profiles")
        .update({ mfa_recovery_digest: digest })
        .eq("id", userData.user.id);
    }
    setQr(null);
    setFactorId(null);
    setVerifyCode("");
    await refresh();
  }

  async function unenroll(id: string) {
    setError(null);
    const { error: unErr } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (unErr) setError(unErr.message);
    else await refresh();
  }

  const verified = factors.length > 0;

  return (
    <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
      <div className="flex items-center gap-2">
        <KeyRound size={14} className="text-foreground-subtle" />
        <p className="text-eyebrow text-foreground-subtle">Multi-factor auth</p>
        {verified && (
          <span className="ml-auto flex items-center gap-1 font-mono text-[9px] uppercase text-acid">
            <ShieldCheck size={10} /> Active
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-foreground-muted">
        TOTP via Supabase Auth MFA. Required for Citadel and Admin routes after enrollment.
        Enable leaked-password protection in the Supabase dashboard.
      </p>

      {loading ? (
        <p className="mt-4 text-xs text-foreground-subtle">Loading factors…</p>
      ) : verified ? (
        <div className="mt-4 space-y-2">
          {factors.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-sm border border-white/[0.06] px-3 py-2 text-xs"
            >
              <span>{f.friendly_name ?? "Authenticator"}</span>
              <button
                type="button"
                onClick={() => void unenroll(f.id)}
                className="text-threat hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : qr ? (
        <div className="mt-4 space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="TOTP QR code" className="mx-auto h-40 w-40 rounded-sm border border-white/10" />
          <input
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            className="w-full rounded-sm border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => void confirmEnroll()}
            className="rounded-sm border border-acid/30 bg-acid/10 px-4 py-2 text-xs uppercase text-acid"
          >
            Verify & enable
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={enrolling}
          onClick={() => void startEnroll()}
          className="mt-4 flex items-center gap-2 rounded-sm border border-white/10 px-4 py-2 text-xs uppercase tracking-wider text-foreground hover:bg-white/[0.04] disabled:opacity-50"
        >
          {enrolling && <Loader2 size={12} className="animate-spin" />}
          Enroll authenticator
        </button>
      )}

      {recoveryCodes && (
        <div className="mt-4 rounded-sm border border-acid/20 bg-acid/5 p-4">
          <p className="font-mono text-[10px] uppercase text-acid">Recovery codes — save once</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs">
            {recoveryCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(recoveryCodes.join("\n"));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-3 flex items-center gap-1 text-[10px] uppercase text-foreground-subtle"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy codes"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 font-mono text-[10px] text-threat">{error}</p>}
    </div>
  );
}
