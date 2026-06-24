"use client";

import * as React from "react";
import Link from "next/link";
import {
  mergeAlmanacEntries,
  runCveAlmanacIngest,
  setAlmanacPublished,
} from "@/app/admin/almanac/actions";
import type { AlmanacEntry } from "@/lib/almanac/types";

export function AlmanacAdminPanel({ entries }: { entries: AlmanacEntry[] }) {
  const [rows, setRows] = React.useState(entries);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function publish(id: string, published: boolean) {
    setBusy(id);
    const r = await setAlmanacPublished(id, published);
    setBusy(null);
    if (!r.ok) {
      setMessage(r.error ?? "Update failed");
      return;
    }
    setRows((prev) =>
      prev.map((e) => (e.id === id ? { ...e, published } : e)),
    );
  }

  async function mergeSelected() {
    const ids = [...selected];
    if (ids.length < 2) {
      setMessage("Select at least two entries to merge.");
      return;
    }
    const keepId = ids[0]!;
    setBusy("merge");
    const r = await mergeAlmanacEntries(keepId, ids.slice(1));
    setBusy(null);
    if (!r.ok) {
      setMessage(r.error ?? "Merge failed");
      return;
    }
    setRows((prev) => prev.filter((e) => !ids.slice(1).includes(e.id)));
    setSelected(new Set([keepId]));
    setMessage(`Merged ${ids.length - 1} duplicate(s) into keeper.`);
  }

  async function ingestCve() {
    setBusy("cve");
    const r = await runCveAlmanacIngest();
    setBusy(null);
    if (!r.ok) {
      setMessage(r.error ?? "CVE ingest failed");
      return;
    }
    setMessage(
      `CVE ingest: scanned ${r.scanned}, inserted ${r.inserted}, updated ${r.updated}. Refresh to see rows.`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy === "cve"}
          onClick={() => void ingestCve()}
          className="rounded border border-violet-400/30 bg-violet-400/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-violet-300 disabled:opacity-50"
        >
          Ingest CISA KEV (LLM keywords)
        </button>
        <button
          type="button"
          disabled={busy === "merge" || selected.size < 2}
          onClick={() => void mergeSelected()}
          className="rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-amber-300 disabled:opacity-50"
        >
          Merge selected → first
        </button>
      </div>

      {message ? (
        <p className="font-mono text-[11px] text-white/55">{message}</p>
      ) : null}

      <div className="overflow-x-auto rounded border border-white/[0.08]">
        <table className="w-full min-w-[720px] text-left text-[11px]">
          <thead className="border-b border-white/[0.08] bg-black/40 font-mono uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-3 py-2">Sel</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Family</th>
              <th className="px-3 py-2">OWASP</th>
              <th className="px-3 py-2">Sev</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Last seen</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-white/[0.04]">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    aria-label={`Select ${e.title}`}
                  />
                </td>
                <td className="max-w-[200px] truncate px-3 py-2 text-white/85">
                  {e.title}
                </td>
                <td className="px-3 py-2 font-mono text-white/55">{e.family}</td>
                <td className="px-3 py-2 font-mono text-white/45">
                  {e.owasp_id ?? "—"}
                </td>
                <td className="px-3 py-2 uppercase text-white/55">{e.severity}</td>
                <td className="px-3 py-2 font-mono text-white/45">
                  {e.source_type}
                  {e.cve_id ? ` · ${e.cve_id}` : ""}
                </td>
                <td className="px-3 py-2 font-mono text-white/40">
                  {new Date(e.last_seen_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {e.published ? (
                      <button
                        type="button"
                        disabled={busy === e.id}
                        onClick={() => void publish(e.id, false)}
                        className="rounded border border-white/15 px-2 py-1 text-[9px] uppercase text-white/55"
                      >
                        Unpublish
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === e.id}
                        onClick={() => void publish(e.id, true)}
                        className="rounded border border-[#D1FF00]/30 px-2 py-1 text-[9px] uppercase text-[#D1FF00]"
                      >
                        Publish
                      </button>
                    )}
                    <Link
                      href={`/resources/almanac/${e.slug}`}
                      className="rounded border border-white/10 px-2 py-1 text-[9px] uppercase text-white/45"
                      target="_blank"
                    >
                      Preview
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
