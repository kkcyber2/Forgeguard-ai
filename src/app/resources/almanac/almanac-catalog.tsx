"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { AlmanacEntry } from "@/lib/almanac/types";
import { OWASP_LLM_IDS } from "@/lib/almanac/types";

const SEV_COLORS: Record<string, string> = {
  critical: "text-red-400 border-red-400/30",
  high: "text-amber-300 border-amber-400/30",
  medium: "text-sky-300 border-sky-400/30",
  low: "text-white/50 border-white/15",
  info: "text-white/40 border-white/10",
};

export function AlmanacCatalog({
  entries,
  families,
  owaspIds,
  initialQ,
  initialFamily,
  initialOwasp,
}: {
  entries: AlmanacEntry[];
  families: string[];
  owaspIds: string[];
  initialQ: string;
  initialFamily: string;
  initialOwasp: string;
}) {
  const [q, setQ] = React.useState(initialQ);

  return (
    <div className="space-y-8">
      <form
        method="get"
        className="flex flex-col gap-3 rounded-sm border border-white/[0.08] bg-white/[0.02] p-4 md:flex-row md:items-end"
      >
        <label className="flex-1">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-white/40">
            Search
          </span>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="prompt injection, jailbreak, LLM01…"
              className="w-full rounded-sm border border-white/[0.08] bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/25"
            />
          </div>
        </label>
        <label>
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-white/40">
            Family
          </span>
          <select
            name="family"
            defaultValue={initialFamily}
            className="min-w-[140px] rounded-sm border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white"
          >
            <option value="">All families</option>
            {families.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-white/40">
            OWASP LLM
          </span>
          <select
            name="owasp"
            defaultValue={initialOwasp}
            className="min-w-[120px] rounded-sm border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white"
          >
            <option value="">All</option>
            {[...OWASP_LLM_IDS, ...owaspIds.filter((id) => !(OWASP_LLM_IDS as readonly string[]).includes(id))]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-sm border border-[#D1FF00]/40 bg-[#D1FF00]/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-[#D1FF00]"
        >
          Filter
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="py-12 text-center font-mono text-sm text-white/40">
          No published entries match your filters yet.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {entries.map((e) => (
            <li key={e.id}>
              <Link
                href={`/resources/almanac/${e.slug}`}
                className="block rounded-sm border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-[#D1FF00]/25"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${SEV_COLORS[e.severity] ?? SEV_COLORS.medium}`}
                  >
                    {e.severity}
                  </span>
                  {e.owasp_id ? (
                    <span className="font-mono text-[9px] text-white/40">{e.owasp_id}</span>
                  ) : null}
                  <span className="font-mono text-[9px] text-white/30">{e.family}</span>
                </div>
                <h2 className="text-sm font-semibold text-white">{e.title}</h2>
                <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-white/50">
                  {e.summary_md.replace(/[#*_`]/g, "").slice(0, 220)}
                </p>
                <p className="mt-3 font-mono text-[9px] text-white/30">
                  Last seen {new Date(e.last_seen_at).toLocaleDateString()}
                  {e.source_type === "cve" ? " · External CVE" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
