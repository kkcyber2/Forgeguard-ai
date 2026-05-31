import * as React from "react";

/** Monospace-styled section block for legal documents. */
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 border-b border-white/[0.06] pb-2 font-mono text-sm font-semibold tracking-wide text-foreground">
        {title}
      </h2>
      <div className="space-y-4 font-mono text-[13px] leading-relaxed">{children}</div>
    </section>
  );
}

export function LegalBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-foreground-muted">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-acid/50" />
      {children}
    </li>
  );
}
