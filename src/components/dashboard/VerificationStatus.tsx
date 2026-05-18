"use client";

import { useState, useTransition } from "react";
import {
  ShieldCheck,
  Globe,
  Code2,
  Copy,
  Check,
  Loader2,
  BadgeCheck,
  AlertCircle,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────────── */
export interface VerificationStatusProps {
  userType:       "client" | "hacker" | "developer" | null;
  accessLevel:    number;
  domainVerified: boolean;
  domainToken:    string | null;
  handle:         string;
}

const TYPE_META = {
  client:    { label: "Client",    Icon: Globe,     color: "rgb(56,189,248)" },
  hacker:    { label: "Hacker",    Icon: ShieldCheck,color: "#D1FF00" },
  developer: { label: "Developer", Icon: Code2,      color: "rgb(167,139,250)" },
} as const;

/* ── Component ──────────────────────────────────────────────────────── */
export function VerificationStatus({
  userType,
  accessLevel,
  domainVerified,
  domainToken,
  handle,
}: VerificationStatusProps) {
  const [token,       setToken]       = useState<string | null>(domainToken);
  const [verified,    setVerified]    = useState(domainVerified);
  const [copied,      setCopied]      = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  const meta = userType ? TYPE_META[userType] : TYPE_META["hacker"];
  const Icon = meta.Icon;

  async function generateToken() {
    startTransition(async () => {
      const res = await fetch("/api/verify-domain", { method: "POST" });
      const json = await res.json() as { token?: string; error?: string };
      if (json.token) setToken(json.token);
      else setVerifyError(json.error ?? "Failed to generate token");
    });
  }

  async function verifyDomain() {
    if (!token) return;
    setVerifyError(null);
    startTransition(async () => {
      const res  = await fetch("/api/verify-domain", { method: "PUT" });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (json.ok) {
        setVerified(true);
      } else {
        setVerifyError(json.error ?? "DNS record not found. Try again in a few minutes.");
      }
    });
  }

  function copyToken() {
    if (!token) return;
    const txtRecord = `forgeguard-verify=${token}`;
    navigator.clipboard.writeText(txtRecord).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      {/* Identity row */}
      <div className="flex items-center justify-between rounded-sm px-4 py-3"
        style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-sm"
            style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)" }}
          >
            <Icon size={16} style={{ color: meta.color }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium text-white/70">Identity</p>
            <p className="font-mono text-sm font-semibold" style={{ color: meta.color }}>
              {meta.label}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/30">Access level</p>
          <p className="font-mono text-sm text-white/70">{accessLevel}</p>
        </div>
      </div>

      {/* Domain verification */}
      <div className="rounded-sm" style={{ border: "0.5px solid rgba(255,255,255,0.06)" }}>
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-white/40" strokeWidth={1.5} />
            <span className="text-sm font-medium text-white/70">Domain Verification</span>
          </div>
          {verified ? (
            <div className="flex items-center gap-1.5">
              <BadgeCheck size={14} style={{ color: "#D1FF00" }} strokeWidth={1.75} />
              <span className="font-mono text-xs" style={{ color: "#D1FF00" }}>Verified</span>
            </div>
          ) : (
            <span className="font-mono text-xs text-white/25">Unverified</span>
          )}
        </div>

        <div className="px-4 py-4 space-y-3">
          {verified ? (
            <p className="text-xs text-white/40 leading-relaxed">
              Your domain ownership has been confirmed. Your handle{" "}
              <span className="font-mono text-white/60">@{handle}</span> displays a
              verified badge on the leaderboard.
            </p>
          ) : (
            <>
              <p className="text-xs text-white/40 leading-relaxed">
                Prove ownership of your organization's domain by adding a DNS TXT record.
                This unlocks the verified badge on the leaderboard and increases your
                trust level.
              </p>

              {!token ? (
                <button
                  onClick={generateToken}
                  disabled={isPending}
                  className="flex h-8 items-center gap-2 rounded-sm px-3 text-xs font-medium transition-all disabled:opacity-50"
                  style={{
                    background: "rgba(209,255,0,0.08)",
                    border: "0.5px solid rgba(209,255,0,0.25)",
                    color: "#D1FF00",
                  }}
                >
                  {isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Globe size={12} strokeWidth={1.75} />
                  )}
                  Generate verification token
                </button>
              ) : (
                <>
                  <div
                    className="rounded-sm px-3 py-2"
                    style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.08)" }}
                  >
                    <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-white/30">
                      Add this DNS TXT record to your domain
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <code className="flex-1 break-all font-mono text-[11px] text-white/60">
                        forgeguard-verify={token}
                      </code>
                      <button
                        onClick={copyToken}
                        className="flex-none rounded p-1 text-white/40 transition-colors hover:text-white/70"
                        title="Copy"
                      >
                        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={verifyDomain}
                    disabled={isPending}
                    className="flex h-8 items-center gap-2 rounded-sm px-3 text-xs font-medium transition-all disabled:opacity-50"
                    style={{
                      background: "rgba(209,255,0,0.08)",
                      border: "0.5px solid rgba(209,255,0,0.25)",
                      color: "#D1FF00",
                    }}
                  >
                    {isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={12} strokeWidth={1.75} />
                    )}
                    Check DNS &amp; verify
                  </button>
                </>
              )}

              {verifyError && (
                <div className="flex items-start gap-2 rounded-sm px-3 py-2 text-xs text-red-400"
                  style={{ background: "rgba(239,68,68,0.05)", border: "0.5px solid rgba(239,68,68,0.2)" }}
                >
                  <AlertCircle size={12} className="mt-[1px] flex-none" strokeWidth={1.75} />
                  {verifyError}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
