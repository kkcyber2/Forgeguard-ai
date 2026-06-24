import { BadgeCheck, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTagLabel, type TrustTier } from "@/lib/trust/identity";

const TIER_STYLES: Record<
  TrustTier,
  { border: string; bg: string; text: string }
> = {
  unverified: {
    border: "border-white/15",
    bg: "bg-white/[0.03]",
    text: "text-white/40",
  },
  domain: {
    border: "border-[#D1FF00]/25",
    bg: "bg-[#D1FF00]/[0.06]",
    text: "text-[#D1FF00]/90",
  },
  "work-email": {
    border: "border-sky-400/30",
    bg: "bg-sky-400/10",
    text: "text-sky-300",
  },
  kyc: {
    border: "border-[#D1FF00]/30",
    bg: "bg-[#D1FF00]/[0.08]",
    text: "text-[#D1FF00]",
  },
  sovereign: {
    border: "border-violet-400/35",
    bg: "bg-violet-400/10",
    text: "text-violet-300",
  },
};

export interface TrustTagBadgeProps {
  tag?: string | null;
  tier?: TrustTier;
  verified?: boolean;
  /** Shown with strikethrough when user typed a tag without DNS proof */
  unverifiedPreview?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function TrustTagBadge({
  tag,
  tier = "domain",
  verified = true,
  unverifiedPreview,
  size = "sm",
  className,
}: TrustTagBadgeProps) {
  if (!verified && unverifiedPreview) {
    const label = formatTagLabel(unverifiedPreview);
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono uppercase tracking-[0.14em] line-through opacity-55",
          size === "sm" ? "text-[8px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5",
          className,
        )}
        title="Unverified company tag"
      >
        {label}
        <span className="no-underline not-italic normal-case tracking-normal text-white/35">
          unverified
        </span>
      </span>
    );
  }

  if (!tag || !verified) return null;

  const style = TIER_STYLES[tier] ?? TIER_STYLES.domain;
  const label = formatTagLabel(tag);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border-[0.5px] font-mono uppercase",
        style.border,
        style.bg,
        style.text,
        size === "sm"
          ? "px-1.5 py-0.5 text-[8px] tracking-[0.14em]"
          : "px-2 py-0.5 text-[10px] tracking-[0.15em]",
        className,
      )}
      title={`Trust tier: ${tier}`}
    >
      {tier === "work-email" ? (
        <Mail size={size === "sm" ? 8 : 9} strokeWidth={2} />
      ) : (
        <BadgeCheck size={size === "sm" ? 8 : 9} strokeWidth={2} />
      )}
      {label}
    </span>
  );
}
