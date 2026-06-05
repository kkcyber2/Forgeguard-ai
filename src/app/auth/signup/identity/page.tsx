"use client";

/**
 * /auth/signup/identity — 3D Glass Slab Identity Selector
 * ─────────────────────────────────────────────────────────
 * Framer Motion 3D glass slabs with holographic sheen.
 * Cards flip 180° on selection, revealing a "LOCKED IN" face.
 * Aesthetic: Sovereign OS — Obsidian / Acid Green / Electric Purple.
 */

import { useState, useTransition } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { ShieldCheck, Code2, Globe, CheckCircle2 } from "lucide-react";
import { setUserIdentity, type UserType } from "./actions";

/* ─── identity definitions ─────────────────────────────────────────── */
const IDENTITIES: {
  type: UserType;
  label: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  glow: string;
  badge: string;
  capabilities: string[];
}[] = [
  {
    type: "client",
    label: "CLIENT",
    subtitle: "Security Buyer",
    description:
      "You represent an organization seeking adversarial testing services. Full scan access, executive reports, and remediation tracking.",
    icon: Globe,
    accent: "#38BDF8",
    glow: "0 0 48px rgba(56,189,248,0.18), 0 0 0 0.5px rgba(56,189,248,0.35)",
    badge: "ENTERPRISE",
    capabilities: ["Full scan reports", "Domain verification", "Remediation tracker", "Export to Aegis", "Mission Board posting"],
  },
  {
    type: "hacker",
    label: "RESEARCHER",
    subtitle: "Compliance Operator",
    description:
      "You live in terminals and attack surfaces. Unlock the full mutation engine, bounty vault, Mission Feed, and Marine Agent Swarm.",
    icon: ShieldCheck,
    accent: "#D1FF00",
    glow: "0 0 48px rgba(209,255,0,0.18), 0 0 0 0.5px rgba(209,255,0,0.4)",
    badge: "OPERATOR",
    capabilities: ["Mutation engine", "Bounty vault", "The Forge editor", "Mission Feed", "Hacker Bazaar"],
  },
  {
    type: "developer",
    label: "DEVELOPER",
    subtitle: "API & Integration",
    description:
      "You build on top of ForgeGuard. Access the API, SDKs, and webhook integrations to embed AI red-teaming into your CI/CD pipeline.",
    icon: Code2,
    accent: "#8B5CF6",
    glow: "0 0 48px rgba(139,92,246,0.18), 0 0 0 0.5px rgba(139,92,246,0.35)",
    badge: "BUILDER",
    capabilities: ["REST API access", "Webhook integrations", "CI/CD plugins", "Custom scan rules"],
  },
];

/* ─── tilt card ────────────────────────────────────────────────────── */
function GlassSlab({
  identity,
  selected,
  flipped,
  onSelect,
  index,
}: {
  identity: typeof IDENTITIES[0];
  selected: boolean;
  flipped: boolean;
  onSelect: () => void;
  index: number;
}) {
  const Icon = identity.icon;
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 220, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 220, damping: 20 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleMouseLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: "800px" }}
    >
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onSelect}
        whileTap={{ scale: 0.97 }}
        className="relative cursor-pointer rounded-[6px]"
      >
        {/* ── flip container ─────────────────────────────────────── */}
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: "preserve-3d", position: "relative", minHeight: 380 }}
        >
          {/* ── FRONT FACE ─────────────────────────────────────── */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              position: "absolute",
              inset: 0,
              borderRadius: 6,
              background: selected
                ? `linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)`
                : `linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)`,
              border: `0.5px solid ${selected ? identity.accent + "66" : "rgba(255,255,255,0.08)"}`,
              boxShadow: selected ? identity.glow : "none",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              overflow: "hidden",
            }}
          >
            {/* Holographic sheen — pseudo via SVG gradient */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(125deg,
                  ${identity.accent}0a 0%,
                  transparent 40%,
                  rgba(255,255,255,0.03) 60%,
                  ${identity.accent}06 100%)`,
                pointerEvents: "none",
              }}
            />
            {/* Scanline texture */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 4px)",
                pointerEvents: "none",
              }}
            />

            <div className="relative p-6">
              {/* Badge row */}
              <div className="mb-5 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: identity.accent }}>
                  {identity.badge}
                </span>
                <motion.span
                  animate={{ opacity: selected ? [0.4, 1, 0.4] : 0.3 }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: identity.accent }}
                />
              </div>

              {/* Icon */}
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-[4px]"
                style={{
                  background: `${identity.accent}14`,
                  border: `0.5px solid ${identity.accent}30`,
                  color: identity.accent,
                }}
              >
                <Icon size={20} strokeWidth={1.5} />
              </div>

              {/* Labels */}
              <h2 className="mb-0.5 font-mono text-lg font-semibold tracking-wide" style={{ color: identity.accent }}>
                {identity.label}
              </h2>
              <p className="mb-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{identity.subtitle}</p>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                {identity.description}
              </p>

              {/* Capabilities */}
              <ul className="space-y-1.5">
                {identity.capabilities.map((cap) => (
                  <li key={cap} className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
                    <span className="h-px w-3 flex-none" style={{ background: identity.accent, opacity: 0.55 }} />
                    {cap}
                  </li>
                ))}
              </ul>
            </div>

            {/* Bottom accent bar */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[1px]"
              style={{
                background: selected
                  ? `linear-gradient(90deg, transparent, ${identity.accent}, transparent)`
                  : "transparent",
              }}
            />
          </div>

          {/* ── BACK FACE (selected / locked-in state) ─────────── */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              position: "absolute",
              inset: 0,
              borderRadius: 6,
              background: `linear-gradient(135deg, ${identity.accent}18 0%, rgba(5,5,5,0.9) 100%)`,
              border: `0.5px solid ${identity.accent}55`,
              boxShadow: identity.glow,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <CheckCircle2 size={40} style={{ color: identity.accent }} strokeWidth={1.5} />
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: identity.accent }}>
                Identity Locked
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{identity.label}</p>
            </div>
            <p className="text-xs text-center px-6" style={{ color: "rgba(255,255,255,0.4)" }}>
              Access level configured. Click confirm below to deploy.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ─── page ─────────────────────────────────────────────────────────── */
export default function IdentityPage() {
  const [selected, setSelected] = useState<UserType | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelect(type: UserType) {
    setSelected((prev) => (prev === type ? null : type));
  }

  function handleConfirm() {
    if (!selected) return;
    startTransition(async () => {
      await setUserIdentity(selected);
    });
  }

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16 overflow-hidden"
      style={{ background: "#050505" }}
    >
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(209,255,0,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12 text-center relative z-10"
      >
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em]" style={{ color: "#D1FF00" }}>
          [ Identity Protocol — Stronghold 2.0 ]
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Choose Your Identity
        </h1>
        <p className="mt-3 max-w-md mx-auto text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          This configures your access level, tools, and interface layout. You can update it later in Settings.
        </p>
      </motion.div>

      {/* Glass Slabs */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl">
        {IDENTITIES.map((identity, i) => (
          <GlassSlab
            key={identity.type}
            identity={identity}
            selected={selected === identity.type}
            flipped={selected === identity.type}
            onSelect={() => handleSelect(identity.type)}
            index={i}
          />
        ))}
      </div>

      {/* Confirm */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="relative z-10 mt-10 flex flex-col items-center gap-3"
      >
        <motion.button
          onClick={handleConfirm}
          disabled={!selected || isPending}
          whileHover={{ scale: selected ? 1.02 : 1 }}
          whileTap={{ scale: selected ? 0.98 : 1 }}
          className="relative h-11 min-w-[240px] rounded-[4px] font-mono text-sm font-semibold uppercase tracking-[0.14em] transition-all duration-200 disabled:cursor-not-allowed overflow-hidden"
          style={{
            background: selected ? "#D1FF00" : "rgba(255,255,255,0.04)",
            color: selected ? "#050505" : "rgba(255,255,255,0.2)",
            border: selected ? "none" : "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Deploying…
            </span>
          ) : selected ? (
            `Deploy as ${selected.toUpperCase()}`
          ) : (
            "Select an Identity"
          )}
        </motion.button>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.18)" }}>
          Access level locks in on confirmation · Modifiable in Settings
        </p>
      </motion.div>
    </div>
  );
}
