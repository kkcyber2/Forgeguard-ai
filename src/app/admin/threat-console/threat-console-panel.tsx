"use client";

import * as React from "react";
import { ShieldBan, ShieldOff } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { unblockIpHash, type BlocklistRow, type PerimeterEventRow } from "./actions";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function severityClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "text-red-400";
    case "high":
      return "text-orange-400";
    case "medium":
      return "text-yellow-400";
    default:
      return "text-white/60";
  }
}

export function ThreatConsolePanel({
  events,
  blocks,
}: {
  events: PerimeterEventRow[];
  blocks: BlocklistRow[];
}) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleUnblock(ipHash: string, blockId: string) {
    setPending(blockId);
    setMessage(null);
    const res = await unblockIpHash(ipHash, blockId);
    setPending(null);
    setMessage(res.ok ? "Block lifted." : res.error ?? "Unblock failed.");
  }

  return (
    <div className="space-y-8">
      {message && (
        <p className="rounded border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-lime-400">
          {message}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ShieldBan size={16} className="text-red-400" />
          <h2 className="text-sm font-medium text-white">Active IP blocks (hashed)</h2>
          <span className="font-mono text-xs text-white/40">({blocks.length})</span>
        </div>
        {blocks.length === 0 ? (
          <p className="text-sm text-white/40">No active blocks.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-white/10">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-white/10 bg-black/40 font-mono uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-3 py-2">IP hash</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => (
                  <tr key={b.id} className="border-b border-white/5">
                    <td className="px-3 py-2 font-mono text-lime-400/90">{b.ip_hash}</td>
                    <td className="px-3 py-2">{b.threat_score}</td>
                    <td className="px-3 py-2">{b.geo_country ?? "—"}</td>
                    <td className="px-3 py-2 text-white/70">{b.reason}</td>
                    <td className="px-3 py-2 text-white/50">{formatWhen(b.expires_at)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className={buttonStyles({ variant: "ghost", size: "sm" })}
                        disabled={pending === b.id}
                        onClick={() => void handleUnblock(b.ip_hash, b.id)}
                      >
                        <ShieldOff size={12} />
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-white">Perimeter events (latest 200)</h2>
        {events.length === 0 ? (
          <p className="text-sm text-white/40">No perimeter events yet.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-white/10">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-white/10 bg-black/40 font-mono uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">IP hash</th>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2">Δ score</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white/50">{formatWhen(e.created_at)}</td>
                    <td className={`px-3 py-2 font-mono uppercase ${severityClass(e.severity)}`}>
                      {e.severity}
                    </td>
                    <td className="px-3 py-2 font-mono text-white/70">{e.ip_hash}</td>
                    <td className="px-3 py-2 text-white/60">{e.path ?? "—"}</td>
                    <td className="px-3 py-2">{e.threat_delta ?? "—"}</td>
                    <td className="px-3 py-2">{e.geo_country ?? "—"}</td>
                    <td className="px-3 py-2 text-white/70">{e.reason ?? e.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
