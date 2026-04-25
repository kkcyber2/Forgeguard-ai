import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "secure"
  | "threat"
  | "warn"
  | "info"
  | "admin"
  | "live";

const tones: Record<Tone, string> = {
  neutral: "bg-white/5 text-foreground-muted border-white/10",
  secure: "bg-acid-wash text-acid border-acid/30",
  threat: "bg-threat-wash text-threat border-threat/30",
  warn: "bg-amber-500/10 text-amber-300 border-amber-400/30",
  info: "bg-sky-500/10 text-sky-300 border-sky-400/30",
  admin: "bg-accent-wash text-accent-soft border-accent/30",
  live: "bg-acid-wash text-acid border-acid/30",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ tone = "neutral", dot, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-5 px-2 rounded-xs",
        "text-[10px] font-medium uppercase tracking-[0.14em]",
        "border-hairline",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dot ? (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "secure" || tone === "live"
              ? "bg-acid animate-pulse-acid"
              : tone === "threat"
              ? "bg-threat animate-pulse-threat"
              : tone === "warn"
              ? "bg-amber-400"
              : tone === "info"
              ? "bg-sky-400"
              : tone === "admin"
              ? "bg-accent"
              : "bg-foreground-muted",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
