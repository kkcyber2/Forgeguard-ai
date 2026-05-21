import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function CompanyTagBadge({ tag }: { tag: string }) {
  const label = tag.startsWith("[") ? tag : `[${tag}]`;
  return (
    <span className="inline-flex rounded-[2px] border-[0.5px] border-[#D1FF00]/25 bg-[#D1FF00]/[0.06] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[#D1FF00]/90">
      {label}
    </span>
  );
}

export function OperatorNameBadge({
  name,
  identityVerified,
  companyTag,
  domainVerified,
}: {
  name: string;
  identityVerified?: boolean;
  companyTag?: string | null;
  domainVerified?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="truncate font-mono text-[11px] text-white/90">{name}</span>
      {identityVerified && <VerifiedCheckmark />}
      {domainVerified && companyTag && <CompanyTagBadge tag={companyTag} />}
    </span>
  );
}
