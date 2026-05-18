"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { AlertTriangle, ShieldCheck, X, Radiation, Zap } from "lucide-react";
import { submitLegalAuthorization, type LegalIntensity } from "@/app/dashboard/scans/legal-actions";

/* ── Types ────────────────────────────────────────────────────────── */
interface LegalVerificationModalProps {
  intensity: LegalIntensity;
  onAuthorized: (authId: string) => void;
  onCancel: () => void;
}

const INTENSITY_META = {
  high: {
    label:        "HIGH INTENSITY",
    Icon:         Zap,
    accentColor:  "rgb(251,191,36)",     // amber-400
    borderColor:  "rgba(251,191,36,0.3)",
    bgColor:      "rgba(251,191,36,0.04)",
    glowStyle:    { boxShadow: "0 0 40px rgba(251,191,36,0.08)" },
    description:  "Aggressive mutation cycles. Generates multi-step jailbreaks, prompt injection chains, and role-play exploits against your target endpoint.",
  },
  nuclear: {
    label:        "NUCLEAR",
    Icon:         Radiation,
    accentColor:  "rgb(239,68,68)",      // red-500
    borderColor:  "rgba(239,68,68,0.4)",
    bgColor:      "rgba(239,68,68,0.05)",
    glowStyle:    { boxShadow: "0 0 40px rgba(239,68,68,0.12)" },
    description:  "Maximum adversarial pressure. Unleashes the Marine Agent Swarm — uncensored model routing, social engineering templates, and full EDoS simulation.",
  },
} as const;

const LEGAL_CHECKBOXES: { id: string; text: string }[] = [
  {
    id: "auth_target",
    text: "I confirm I am the owner or have written authorization to conduct adversarial testing on the target system.",
  },
  {
    id: "auth_liability",
    text: "I accept full legal liability for any consequences arising from this scan. ForgeGuard AI bears no responsibility.",
  },
  {
    id: "auth_data",
    text: "I understand that scan data, IP address, and this consent record will be logged and retained for compliance purposes.",
  },
  {
    id: "auth_age",
    text: "I am at least 18 years of age and operating in a jurisdiction where adversarial AI testing is lawful.",
  },
];

/* ── Component ────────────────────────────────────────────────────── */
export function LegalVerificationModal({
  intensity,
  onAuthorized,
  onCancel,
}: LegalVerificationModalProps) {
  const meta   = INTENSITY_META[intensity];
  const Icon   = meta.Icon;

  const [fullName,   setFullName]   = useState("");
  const [checked,    setChecked]    = useState<Record<string, boolean>>({});
  const [error,      setError]      = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const allChecked = LEGAL_CHECKBOXES.every((c) => checked[c.id]);
  const canSubmit  = allChecked && fullName.trim().length >= 2 && !isPending;

  // Focus name input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Trap Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  function toggleCheck(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await submitLegalAuthorization(fullName.trim(), intensity);
      if (result.ok && result.authId) {
        onAuthorized(result.authId);
      } else {
        setError(result.error ?? "Authorization failed. Please retry.");
      }
    });
  }

  return (
    /* ── Backdrop ───────────────────────────────────────────────────── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,5,5,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* ── Panel ───────────────────────────────────────────────────── */}
      <div
        className="relative w-full max-w-lg rounded-sm"
        style={{
          background: "#0a0a0a",
          border: `0.5px solid ${meta.borderColor}`,
          ...meta.glowStyle,
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between border-b px-6 py-5"
          style={{
            borderColor: meta.borderColor,
            background:  meta.bgColor,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-sm"
              style={{ background: meta.bgColor, border: `0.5px solid ${meta.borderColor}` }}
            >
              <Icon size={18} style={{ color: meta.accentColor }} strokeWidth={1.5} />
            </div>
            <div>
              <p
                className="font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ color: meta.accentColor }}
              >
                Legal Authorization Required
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-white">
                {meta.label} Scan Gate
              </h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="ml-4 flex h-7 w-7 flex-none items-center justify-center rounded-sm text-white/30 transition-colors hover:text-white/70"
            style={{ border: "0.5px solid rgba(255,255,255,0.08)" }}
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Description */}
          <div
            className="flex items-start gap-3 rounded-sm px-3 py-3"
            style={{ background: meta.bgColor, border: `0.5px solid ${meta.borderColor}` }}
          >
            <AlertTriangle
              size={14}
              className="mt-[2px] flex-none"
              style={{ color: meta.accentColor }}
              strokeWidth={1.75}
            />
            <p className="text-xs leading-relaxed text-white/60">{meta.description}</p>
          </div>

          {/* Legal name */}
          <div>
            <label
              htmlFor="legal-name"
              className="mb-1.5 block text-xs font-medium text-white/70"
            >
              Legal Full Name{" "}
              <span className="font-mono text-[10px] text-white/30">
                (as on government ID)
              </span>
            </label>
            <input
              ref={inputRef}
              id="legal-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ada Lovelace"
              className="w-full rounded-sm bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none"
              style={{
                border: "0.5px solid rgba(255,255,255,0.10)",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = meta.borderColor)
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")
              }
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-white/50 uppercase tracking-[0.12em]">
              Acknowledgments
            </p>
            {LEGAL_CHECKBOXES.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-3"
                onClick={() => toggleCheck(item.id)}
              >
                <div
                  className="mt-[2px] flex h-4 w-4 flex-none items-center justify-center rounded-sm transition-all"
                  style={{
                    background:  checked[item.id] ? meta.accentColor : "transparent",
                    border:      checked[item.id]
                      ? `1px solid ${meta.accentColor}`
                      : "0.5px solid rgba(255,255,255,0.20)",
                  }}
                >
                  {checked[item.id] && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path
                        d="M1 3.5L3.5 6L8 1"
                        stroke={intensity === "nuclear" ? "#fff" : "#050505"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-xs leading-relaxed text-white/50">{item.text}</span>
              </label>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-sm border px-3 py-2 text-xs text-red-400"
              style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}
            >
              <AlertTriangle size={12} strokeWidth={1.75} className="flex-none" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 border-t px-6 py-4"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}
        >
          <button
            onClick={onCancel}
            className="h-9 rounded-sm px-4 text-sm text-white/40 transition-colors hover:text-white/70"
            style={{ border: "0.5px solid rgba(255,255,255,0.08)" }}
          >
            Cancel scan
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex h-9 items-center gap-2 rounded-sm px-5 text-sm font-semibold transition-all disabled:cursor-not-allowed"
            style={{
              background:  canSubmit ? meta.accentColor : "rgba(255,255,255,0.04)",
              color:       canSubmit
                ? intensity === "nuclear" ? "#fff" : "#050505"
                : "rgba(255,255,255,0.2)",
              border:      canSubmit ? "none" : "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            {isPending ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Logging authorization…
              </>
            ) : (
              <>
                <ShieldCheck size={14} strokeWidth={1.75} />
                Authorize &amp; Continue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
