import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Section / SectionHeading
 * -----------------------
 * Dense marketing section shell — consistent vertical rhythm, eyebrow
 * label, tight display heading, optional lede.
 */

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("relative w-full py-20 md:py-28 lg:py-32", className)}
    >
      <div className="mx-auto w-full max-w-6xl px-6 md:px-8">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <div className="mb-4 inline-flex items-center gap-2">
          <span className="h-px w-6 bg-acid/60" />
          <span className="text-eyebrow text-acid">{eyebrow}</span>
        </div>
      ) : null}
      <h2 className="text-display-md text-balance text-foreground">{title}</h2>
      {lede ? (
        <p className="mt-5 max-w-2xl text-base md:text-lg text-foreground-muted text-pretty">
          {lede}
        </p>
      ) : null}
    </header>
  );
}
