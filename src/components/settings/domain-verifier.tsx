"use client";

/**
 * DomainVerifier — [GOOGLE SEC] style corporate badge system
 * ───────────────────────────────────────────────────────────
 * Flow:
 * 1. User enters corporate domain (e.g. google.com)
 * 2. System generates a TXT record challenge token
 * 3. User adds TXT record to their DNS
 * 4. "Verify" button triggers DNS lookup API
 * 5. On success: profile gets domain_verified = true + company_tag set
 *
 * Aesthetic: Sovereign OS — Steel Blue badge, Acid Green on success.
 */

import { useState, useTransition } from "react";
import { Globe, BadgeCheck, Loader2, Copy, CheckCheck } from "lucide-react";
import { initiateDomainVerification, checkDomainVerification } from "./identity-actions";

interface Props {
  existingDomain: string | null;
  domainVerified: boolean;
}

export function DomainVerifier({ existingDomain, domainVerified }: Props) {
  const [domain, setDomain] = useState(existingDomain ?? "");
  const [token, setToken] = useState<string | null>(null);
  const [verified, setVerified] = useState(domainVerified);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    if (token) {
      navigator.clipboard.writeText(`forgeguard-verify=${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleInitiate() {
    if (!domain.trim()) { setError("Enter your corporate domain."); return; }
    setError(null);
    startTransition(async () => {
      const res = await initiateDomainVerification(domain.trim().toLowerCase());
      if (res.error) setError(res.error);
      else setToken(res.token ?? null);
    });
  }

  function handleVerify() {
    if (!token) return;
    setError(null);
    startTransition(async () => {
      const res = await checkDomainVerification(domain.trim().toLowerCase(), token);
      if (res.error) setError(res.error);
      else if (res.verified) setVerified(true);
    });
  }

  if (verified) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Globe size={13} style={{ color: "#38BDF8" }} strokeWidth={1.5} />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "#38BDF8" }}>
            Corporate Identity
          </p>
          <span
            className="ml-auto flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-[3px]"
            style={{
              background: "rgba(56,189,248,0.08)",
              border: "0.5px solid rgba(56,189,248,0.3)",
              color: "#38BDF8",
            }}
          >
            <BadgeCheck size={9} strokeWidth={2} />
            Verified
          </span>
        </div>
        <div
          className="flex items-center gap-2 rounded-[3px] px-4 py-3"
          style={{
            background: "rgba(56,189,248,0.05)",
            border: "0.5px solid rgba(56,189,248,0.2)",
          }}
        >
          <BadgeCheck size={14} style={{ color: "#38BDF8" }} strokeWidth={1.5} />
          <span className="font-mono text-sm font-semibold" style={{ color: "#38BDF8" }}>
            [{domain.toUpperCase()}]
          </span>
          <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.35)" }}>
            Domain ownership confirmed. Badge active on all missions.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Globe size={13} style={{ color: "#38BDF8" }} strokeWidth={1.5} />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "#38BDF8" }}>
          Corporate Domain Verification
        </p>
      </div>

      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
        Verify your corporate domain to display a{" "}
        <span style={{ color: "#38BDF8" }}>[COMPANY SEC]</span> badge on your missions. Increases proposal rate by 3×.
      </p>

      {/* Step 1: Enter domain */}
      {!token ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.com"
            className="flex-1 rounded-[3px] px-3 py-2 text-xs outline-none transition-colors"
            style={{
              background: "rgba(0,0,0,0.35)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.75)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(56,189,248,0.35)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
          <button
            type="button"
            onClick={handleInitiate}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-[3px] px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
            style={{ background: "#38BDF8", color: "#050505" }}
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} strokeWidth={2} />}
            Get Token
          </button>
        </div>
      ) : (
        /* Step 2: DNS challenge */
        <div className="flex flex-col gap-3">
          <div
            className="rounded-[3px] p-4"
            style={{
              background: "rgba(0,0,0,0.4)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
              Add this DNS TXT record to <span style={{ color: "#38BDF8" }}>{domain}</span>:
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 rounded-[3px] px-3 py-2 font-mono text-xs break-all"
                style={{
                  background: "rgba(0,0,0,0.5)",
                  border: "0.5px solid rgba(255,255,255,0.06)",
                  color: "#D1FF00",
                }}
              >
                forgeguard-verify={token}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  color: copied ? "#D1FF00" : "rgba(255,255,255,0.4)",
                }}
              >
                {copied ? <CheckCheck size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />}
              </button>
            </div>
            <p className="mt-2 text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
              DNS propagation typically takes 1–5 minutes.
            </p>
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={isPending}
            className="flex items-center justify-center gap-2 rounded-[3px] py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
            style={{ background: "#38BDF8", color: "#050505" }}
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <BadgeCheck size={12} strokeWidth={2} />}
            {isPending ? "Checking DNS…" : "Verify Domain"}
          </button>

          <button
            type="button"
            onClick={() => { setToken(null); setError(null); }}
            className="text-center text-[10px] transition-opacity hover:opacity-70"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            ← Change domain
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: "rgba(255,100,100,0.85)" }}>{error}</p>
      )}
    </div>
  );
}
