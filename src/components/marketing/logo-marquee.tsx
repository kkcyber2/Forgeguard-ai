import * as React from "react";

/**
 * Trust bar. Wordmarks only (no logos) to avoid trademark risk and to
 * keep the strip typographically consistent with the rest of the page.
 */
const marks = [
  "Ansari Labs",
  "Meridian AI",
  "Helix Robotics",
  "Northwind Trust",
  "Paraform",
  "Obsidian.ml",
  "KRYO Finance",
  "Stratus Defense",
];

export function LogoMarquee() {
  return (
    <div className="relative border-y-[0.5px] border-white/[0.06] bg-obsidian-950/60 py-8 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <p className="text-eyebrow text-foreground-subtle mb-6">
          Trusted by security teams at
        </p>
      </div>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-obsidian-950 to-transparent z-10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-obsidian-950 to-transparent z-10"
        />
        <div className="marquee-track gap-14 px-6">
          {[...marks, ...marks].map((m, i) => (
            <span
              key={i}
              className="font-mono text-base text-foreground-subtle/80 uppercase tracking-[0.22em] shrink-0"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
