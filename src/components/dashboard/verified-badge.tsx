import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrustTagBadge } from "@/components/trust/trust-tag-badge";
import type { TrustTier } from "@/lib/trust/identity";

export function VerifiedCheckmark({
  className,
  pulse = true,
}: {
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        pulse && "animate-pulse",
        className,
      )}
      title="Identity verified"
    >
      <BadgeCheck
        size={12}
        strokeWidth={2}
        className="text-[#D1FF00]"
        style={{ filter: "drop-shadow(0 0 4px rgba(209,255,0,0.7))" }}
      />
    </span>
  );
}

export function CompanyTagBadge({
  tag,
  tier = "domain",
}: {
  tag: string;
  tier?: TrustTier;
}) {
  return <TrustTagBadge tag={tag} tier={tier} verified size="sm" />;
}

export function OperatorNameBadge({
  name,
  identityVerified,
  companyTag,
  domainVerified,
  trustTier = "domain",
}: {
  name: string;
  identityVerified?: boolean;
  companyTag?: string | null;
  domainVerified?: boolean;
  trustTier?: TrustTier;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="truncate font-mono text-[11px] text-white/90">{name}</span>
      {identityVerified && <VerifiedCheckmark />}
      <TrustTagBadge
        tag={companyTag}
        tier={trustTier}
        verified={Boolean(domainVerified && companyTag)}
      />
    </span>
  );
}
