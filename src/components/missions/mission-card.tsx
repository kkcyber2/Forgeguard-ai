"use client";

/**
 * MissionCard — Sovereign Mission Vault
 * ─────────────────────────────────────
 * LinkedIn-card style mission listing. Shows budget, rank gate,
 * company badge, and status. Links to mission detail page.
 * Aesthetic: Obsidian / Acid Green / Steel Gray (no bubbly rounds).
 */

import Link from "next/link";
import { Coins, ShieldCheck, BadgeCheck, Clock, ArrowRight } from "lucide-react";

const RANK_COLORS: Record<string, string> = {
  RECRUIT:   "rgba(255,255,255,0.35)",
  OPERATIVE: "#38BDF8",
  ELITE:     "#D1FF00",
  SOVEREIGN: "#8B5CF6",
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  open:        { label: "OPEN",        color: "#D1FF00" },
  in_progress: { label: "IN PROGRESS", color: "#38BDF8" },
  completed:   { label: "COMPLETED",   color: "rgba(255,255,255,0.3)" },
  cancelled:   { label: "CANCELLED",   color: "rgba(255,100,100,0.7)" },
};

interface MissionCardProps {
  id: string;
  title: string;
  description: string;
  budgetCredits: number;
  requiredRank: string;
  companyTag: string | null;
  domainVerified: boolean;
  status: string;
  createdAt: string;
  isOwner: boolean;
}

export function MissionCard({
  id,
  title,
  description,
  budgetCredits,
  requiredRank,
  companyTag,
  domainVerified,
  status,
  createdAt,
  isOwner,
}: MissionCardProps) {
  const rankColor = RANK_COLORS[requiredRank] ?? "rgba(255,255,255,0.35)";
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.open;
  const relativeTime = formatRelative(createdAt);

  return (
    <Link
      href={`/dashboard/missions/${id}`}
      className="group block"
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 4,
          padding: "20px 22px",
          transition: "border-color 0.2s, box-shadow 0.2s",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "rgba(209,255,0,0.28)";
          el.style.boxShadow = "0 0 24px rgba(209,255,0,0.06)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "rgba(255,255,255,0.08)";
          el.style.boxShadow = "none";
        }}
      >
        {/* Subtle scanline */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.008) 2px, rgba(255,255,255,0.008) 4px)",
            pointerEvents: "none",
          }}
        />

        {/* ── Top row: company badge + status ─────────────── */}
        <div className="relative flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {companyTag && (
              <span
                className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-[3px]"
                style={{
                  background: "rgba(56,189,248,0.1)",
                  border: "0.5px solid rgba(56,189,248,0.3)",
                  color: "#38BDF8",
                }}
              >
                {domainVerified && <BadgeCheck size={9} strokeWidth={2} />}
                {companyTag}
              </span>
            )}
            {isOwner && (
              <span
                className="font-mono text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-[3px]"
                style={{
                  background: "rgba(139,92,246,0.12)",
                  border: "0.5px solid rgba(139,92,246,0.3)",
                  color: "#8B5CF6",
                }}
              >
                YOUR MISSION
              </span>
            )}
          </div>
          <span
            className="font-mono text-[9px] uppercase tracking-[0.15em]"
            style={{ color: statusStyle.color }}
          >
            ● {statusStyle.label}
          </span>
        </div>

        {/* ── Title ───────────────────────────────────────── */}
        <h3
          className="relative mb-1.5 text-sm font-semibold leading-snug text-white"
          style={{ transition: "color 0.15s" }}
        >
          {title}
        </h3>

        {/* ── Description ─────────────────────────────────── */}
        <p
          className="relative mb-4 text-xs leading-relaxed line-clamp-2"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {description}
        </p>

        {/* ── Stats row ───────────────────────────────────── */}
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          {/* Budget */}
          <div className="flex items-center gap-1.5">
            <Coins size={13} style={{ color: "#D1FF00", opacity: 0.8 }} strokeWidth={1.5} />
            <span className="font-mono text-xs font-semibold" style={{ color: "#D1FF00" }}>
              {budgetCredits.toLocaleString()}
            </span>
            <span className="text-[10px] text-white/40">
              credits
            </span>
          </div>

          {/* Required rank */}
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={12} style={{ color: rankColor, opacity: 0.8 }} strokeWidth={1.5} />
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: rankColor }}>
              {requiredRank}+
            </span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-1 ml-auto">
            <Clock size={11} style={{ color: "rgba(255,255,255,0.2)" }} strokeWidth={1.5} />
            <span className="text-[10px] text-white/40">
              {relativeTime}
            </span>
          </div>

          {/* Arrow */}
          <ArrowRight
            size={13}
            strokeWidth={1.5}
            className="hidden transition-transform group-hover:translate-x-0.5 sm:block"
            style={{ color: "rgba(255,255,255,0.35)" }}
          />
        </div>

        {/* Bottom accent line — only on hover */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "linear-gradient(90deg, transparent, rgba(209,255,0,0.5), transparent)" }}
        />
      </div>
    </Link>
  );
}

/* ── helpers ──────────────────────────────────────────────── */
function formatRelative(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
