import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SectionCard — pane wrapper with hairline header, optional eyebrow,
 * trailing action slot, and body padding. Used for "Active Scans",
 * "Red Teaming Logs", "Global Threats" etc.
 */
export function SectionCard({
  title,
  eyebrow,
  description,
  action,
  children,
  className,
  bodyClassName,
  density = "default",
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  density?: "default" | "flush";
}) {
  return (
    <section
      className={cn(
        "relative bg-surface rounded-sm border-hairline border-white/[0.06]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        "flex flex-col",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b-[0.5px] border-white/[0.06]">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground-subtle">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-0.5 text-sm font-medium tracking-tight text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs text-foreground-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn(density === "flush" ? "" : "p-5", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted transition-colors hover:text-acid"
    >
      {children}
      <ArrowUpRight size={12} strokeWidth={1.5} />
    </Link>
  );
}
