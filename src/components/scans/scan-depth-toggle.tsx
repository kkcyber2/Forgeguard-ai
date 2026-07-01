"use client";

import * as React from "react";

/** Scan depth — maps to engine budget multiplier via scan metadata. */
export function ScanDepthToggle({
  name = "scanDepth",
  defaultDepth = "standard",
}: {
  name?: string;
  defaultDepth?: "shallow" | "standard" | "deep";
}) {
  const [depth, setDepth] = React.useState(defaultDepth);

  return (
    <div className="rounded-sm border border-white/[0.06] bg-black/20 p-4">
      <input type="hidden" name={name} value={depth} />
      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        Scan depth
      </p>
      <p className="mt-1 text-xs text-zinc-600">
        Shallow = faster recon pass · Deep = extended Brain turns (Fable-style)
      </p>
      <div className="mt-3 flex gap-2">
        {(["shallow", "standard", "deep"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDepth(d)}
            className={`rounded-sm px-3 py-1.5 font-mono text-[10px] uppercase ${
              depth === d
                ? "bg-acid/20 text-acid"
                : "border border-white/10 text-zinc-500"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
