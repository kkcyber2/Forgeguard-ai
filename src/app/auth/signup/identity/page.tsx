"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Code2, Globe } from "lucide-react";
import { setUserIdentity, type UserType } from "./actions";

/* ── Identity card definitions ─────────────────────────────────────── */
const IDENTITIES: {
  type: UserType;
  label: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  accentClass: string;
  glowStyle: React.CSSProperties;
  badgeText: string;
  capabilities: string[];
}[] = [
  {
    type: "client",
    label: "CLIENT",
    subtitle: "Security Buyer",
    description:
      "You represent an organization seeking adversarial testing services. Full scan access, executive reports, and remediation tracking.",
    icon: Globe,
    accentClass: "text-sky-400",
    glowStyle: { boxShadow: "0 0 0 1px rgba(56,189,248,0.25), 0 0 24px rgba(56,189,248,0.08)" },
    badgeText: "ENTERPRISE",
    capabilities: ["Full scan reports", "Domain verification", "Remediation tracker", "Export to Aegis"],
  },
  {
    type: "hacker",
    label: "HACKER",
    subtitle: "Adversarial Operator",
    description:
      "You live in terminals and attack surfaces. Unlock the full mutation engine, bounty vault, and Marine Agent Swarm modules.",
    icon: ShieldCheck,
    accentClass: "text-[#D1FF00]",
    glowStyle: { boxShadow: "0 0 0 1px rgba(209,255,0,0.3), 0 0 32px rgba(209,255,0,0.12)" },
    badgeText: "OPERATOR",
    capabilities: ["Mutation engine", "Bounty vault", "The Forge editor", "Intel community"],
  },
  {
    type: "developer",
    label: "DEVELOPER",
    subtitle: "API & Integration",
    description:
      "You build on top of ForgeGuard. Access the API, SDKs, and webhook integrations to embed AI red-teaming into your CI/CD pipeline.",
    icon: Code2,
    accentClass: "text-violet-400",
    glowStyle: { boxShadow: "0 0 0 1px rgba(167,139,250,0.25), 0 0 24px rgba(167,139,250,0.08)" },
    badgeText: "BUILDER",
    capabilities: ["REST API access", "Webhook integrations", "CI/CD plugins", "Custom scan rules"],
  },
];

/* ── Page ───────────────────────────────────────────────────────────── */
export default function IdentityPage() {
  const [selected, setSelected] = useState<UserType | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!selected) return;
    startTransition(async () => {
      await setUserIdentity(selected);
    });
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: "#050505" }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-12 text-center">
        <p
          className="mb-3 font-mono text-xs uppercase tracking-[0.2em]"
          style={{ color: "#D1FF00" }}
        >
          Identity Protocol
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Choose Your Identity
        </h1>
        <p className="mt-3 max-w-md mx-auto text-sm text-white/40">
          This configures your access level, available tools, and interface layout.
          You can change this later in settings.
        </p>
      </div>

      {/* ── Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
        {IDENTITIES.map((identity, i) => {
          const Icon = identity.icon;
          const isSelected = selected === identity.type;
          return (
            <button
              key={identity.type}
              onClick={() => setSelected(identity.type)}
              disabled={isPending}
              className="relative text-left rounded-sm transition-all duration-200 focus:outline-none"
              style={{
                background: isSelected ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                border: isSelected
                  ? `0.5px solid ${identity.type === "client" ? "rgba(56,189,248,0.5)" : identity.type === "hacker" ? "rgba(209,255,0,0.5)" : "rgba(167,139,250,0.5)"}`
                  : "0.5px solid rgba(255,255,255,0.08)",
                ...(isSelected ? identity.glowStyle : {}),
                animationDelay: `${i * 80}ms`,
              }}
            >
              <div className="p-6">
                {/* Badge */}
                <div className="mb-5 flex items-center justify-between">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.18em] ${identity.accentClass}`}
                  >
                    {identity.badgeText}
                  </span>
                  {isSelected && (
                    <span
                      className="h-2 w-2 rounded-full animate-pulse"
                      style={{
                        background:
                          identity.type === "client"
                            ? "rgb(56,189,248)"
                            : identity.type === "hacker"
                            ? "#D1FF00"
                            : "rgb(167,139,250)",
                      }}
                    />
                  )}
                </div>

                {/* Icon */}
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-sm ${identity.accentClass}`}
                  style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" }}
                >
                  <Icon size={20} strokeWidth={1.5} />
                </div>

                {/* Label */}
                <h2
                  className={`mb-1 font-mono text-lg font-semibold tracking-wide ${identity.accentClass}`}
                >
                  {identity.label}
                </h2>
                <p className="mb-3 text-xs text-white/50">{identity.subtitle}</p>
                <p className="mb-5 text-sm leading-relaxed text-white/60">
                  {identity.description}
                </p>

                {/* Capabilities */}
                <ul className="space-y-1.5">
                  {identity.capabilities.map((cap) => (
                    <li key={cap} className="flex items-center gap-2 text-xs text-white/40">
                      <span
                        className="h-px w-3 flex-none"
                        style={{
                          background:
                            identity.type === "client"
                              ? "rgb(56,189,248)"
                              : identity.type === "hacker"
                              ? "#D1FF00"
                              : "rgb(167,139,250)",
                          opacity: 0.6,
                        }}
                      />
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Selected indicator bar */}
              {isSelected && (
                <div
                  className="absolute bottom-0 left-4 right-4 h-px rounded-full"
                  style={{
                    background:
                      identity.type === "client"
                        ? "linear-gradient(90deg, transparent, rgb(56,189,248), transparent)"
                        : identity.type === "hacker"
                        ? "linear-gradient(90deg, transparent, #D1FF00, transparent)"
                        : "linear-gradient(90deg, transparent, rgb(167,139,250), transparent)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Confirm ────────────────────────────────────────────────── */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <button
          onClick={handleConfirm}
          disabled={!selected || isPending}
          className="relative h-11 min-w-[220px] rounded-sm font-mono text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-200 disabled:cursor-not-allowed"
          style={{
            background: selected ? "#D1FF00" : "rgba(255,255,255,0.04)",
            color: selected ? "#050505" : "rgba(255,255,255,0.2)",
            border: selected ? "none" : "0.5px solid rgba(255,255,255,0.08)",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Configuring…
            </span>
          ) : selected ? (
            `Deploy as ${selected.toUpperCase()}`
          ) : (
            "Select an Identity"
          )}
        </button>
        <p className="text-xs text-white/20">Access level locks in on confirmation</p>
      </div>
    </div>
  );
}
