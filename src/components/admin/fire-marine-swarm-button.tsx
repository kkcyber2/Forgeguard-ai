"use client";

import * as React from "react";
import { Crosshair, Loader2 } from "lucide-react";

export function FireMarineSwarmButton() {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const fire = async () => {
    setPending(true);
    setMessage(null);
    try {
      const resp = await fetch("/api/admin/war-machine", { method: "POST" });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        status?: string;
      };
      if (!resp.ok || !data.ok) {
        setMessage(data.error ?? `Dispatch failed (${resp.status})`);
        return;
      }
      setMessage(
        data.message ??
          "Marine Swarm dispatched — scraping Product Hunt AI (last 24h).",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Network error");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void fire()}
        className="flex items-center gap-2 rounded border border-[#FF3131]/40 bg-[#FF3131]/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#FF3131] transition-colors hover:bg-[#FF3131]/20 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Crosshair size={12} strokeWidth={1.75} />
        )}
        Fire Marine Swarm
      </button>
      {message ? (
        <span className="max-w-xs text-right font-mono text-[9px] text-zinc-500">
          {message}
        </span>
      ) : null}
    </div>
  );
}
