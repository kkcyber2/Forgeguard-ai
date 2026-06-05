"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Shield, Cpu } from "lucide-react";
import { BUNKER_POW_ROUNDS } from "@/lib/bunker/bunker-pow";
import { cn } from "@/lib/utils";

export function BunkerChallengeClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const trap = searchParams.get("trap") ?? "unknown";

  const [seed] = React.useState(() => crypto.randomUUID());
  const [progress, setProgress] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function runChallenge() {
    setRunning(true);
    setError(null);
    setProgress(0);

    try {
      const enc = new TextEncoder();
      let current = seed;
      for (let i = 0; i < BUNKER_POW_ROUNDS; i++) {
        const data = enc.encode(`${current}:${i}`);
        const digest = await crypto.subtle.digest("SHA-256", data);
        current = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (i % 5 === 0 || i === BUNKER_POW_ROUNDS - 1) {
          setProgress(Math.round(((i + 1) / BUNKER_POW_ROUNDS) * 100));
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      const res = await fetch("/api/bunker/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, proof: current }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Verification failed");
        return;
      }
      setDone(true);
      setTimeout(() => router.replace("/"), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Challenge failed");
    } finally {
      setRunning(false);
    }
  }

  React.useEffect(() => {
    void runChallenge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 py-16">
      <div
        className={cn(
          "w-full rounded-sm border border-acid/30 bg-obsidian-900/80 p-8",
          "shadow-[0_0_48px_rgba(209,255,0,0.06)]",
        )}
      >
        <div className="mb-6 flex items-center gap-2">
          <Shield size={18} className="text-acid" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-acid">
            Fortress Bunker Challenge
          </span>
        </div>

        <p className="text-sm text-foreground-muted leading-relaxed">
          Smart-Mitigation engaged. Suspicious probe detected on{" "}
          <code className="font-mono text-[12px] text-threat">{trap}</code>.
          Complete the WAF-level proof-of-work to verify you are not an automated scraper.
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-xs border border-white/[0.08] bg-black/40 px-4 py-3">
          <Cpu size={16} className="shrink-0 text-acid" />
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-subtle">
              CPU-Stress PoW — {BUNKER_POW_ROUNDS} sequential SHA-256 rounds
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full bg-acid transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-[10px] text-foreground-muted">{progress}%</p>
          </div>
          {running && <Loader2 size={16} className="animate-spin text-acid" />}
        </div>

        {done && (
          <p className="mt-4 font-mono text-[11px] text-acid">
            Perimeter cleared — redirecting…
          </p>
        )}
        {error && (
          <p className="mt-4 font-mono text-[11px] text-threat">{error}</p>
        )}

        {!running && !done && error && (
          <button
            type="button"
            onClick={() => void runChallenge()}
            className="mt-4 w-full rounded-xs border border-acid/30 bg-acid/[0.08] py-2 font-mono text-[11px] uppercase tracking-widest text-acid hover:bg-acid/[0.14]"
          >
            Retry challenge
          </button>
        )}
      </div>
    </div>
  );
}
