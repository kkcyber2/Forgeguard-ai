"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Loader2, Search, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listMyVaultResults,
  runIntelVaultQuery,
  type VaultResultRow,
} from "@/lib/intel/vault-actions";
import { VAULT_QUERY_LABELS, VAULT_QUERY_TYPES } from "@/lib/intel/vault-types";

function ResultBody({ row }: { row: VaultResultRow }) {
  const [open, setOpen] = React.useState(false);
  const preview =
    row.error_message ??
    (typeof row.result.content === "string"
      ? row.result.content.slice(0, 120)
      : JSON.stringify(row.result).slice(0, 120));

  return (
    <li className="rounded-sm border border-white/[0.06] bg-obsidian-800/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm border border-acid/30 bg-acid/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-acid">
          {row.query_type}
        </span>
        <span className="font-mono text-xs text-foreground">{row.target_domain}</span>
        <time className="ml-auto font-mono text-[10px] text-foreground-subtle">
          {new Date(row.created_at).toLocaleString()}
        </time>
      </div>
      {row.scan_id && (
        <Link
          href={`/dashboard/scans/${row.scan_id}`}
          className="mt-1 inline-block text-[10px] text-acid hover:underline"
        >
          Linked scan · {row.scan_id.slice(0, 8)}
        </Link>
      )}
      <p className={cn("mt-2 text-xs", row.error_message ? "text-red-400" : "text-foreground-muted")}>
        {preview}
        {!open && preview.length >= 120 ? "…" : ""}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-[10px] uppercase tracking-wider text-foreground-subtle"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? "Hide" : "Full result"}
      </button>
      {open && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-sm border border-white/[0.06] bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-foreground-muted">
          {JSON.stringify(row.result, null, 2)}
        </pre>
      )}
    </li>
  );
}

export function IntelVaultPanel() {
  const [domain, setDomain] = React.useState("");
  const [queryType, setQueryType] = React.useState<string>("dns");
  const [scanId, setScanId] = React.useState("");
  const [attestation, setAttestation] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<VaultResultRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setResults(await listMyVaultResults(30));
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runQuery() {
    if (!attestation) {
      setError("Confirm legal OSINT scope before running queries.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await runIntelVaultQuery({
      targetDomain: domain,
      queryType,
      scanId: scanId.trim() || undefined,
    });
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    if (r.result) {
      setResults((prev) => [r.result!, ...prev]);
    } else {
      void refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-sm border border-acid/20 bg-acid/5 p-3">
        <Shield size={16} className="mt-0.5 shrink-0 text-acid" />
        <div className="text-xs leading-relaxed text-foreground-muted">
          <strong className="text-foreground">Legal OSINT only.</strong> Public DNS, RDAP, certs,
          robots.txt, security.txt, and headers. No credential attacks or private data.
          See <code className="text-acid">CITADEL_LAUNCH_VAULT/INTEL_VAULT_SCOPE.md</code>.
        </div>
      </div>

      <div className="space-y-3 rounded-sm border border-white/[0.08] bg-black/20 p-4">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Target domain (e.g. example.com)"
          className="min-h-[44px] w-full rounded-sm border border-white/[0.08] bg-black/30 px-3 text-xs"
          maxLength={253}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={queryType}
            onChange={(e) => setQueryType(e.target.value)}
            className="min-h-[44px] w-full rounded-sm border border-white/[0.08] bg-black/30 px-3 text-xs"
          >
            {VAULT_QUERY_TYPES.map((t) => (
              <option key={t} value={t}>
                {VAULT_QUERY_LABELS[t as keyof typeof VAULT_QUERY_LABELS] ?? t}
              </option>
            ))}
          </select>
          <input
            value={scanId}
            onChange={(e) => setScanId(e.target.value)}
            placeholder="Scan ID (optional — links Recon context)"
            className="min-h-[44px] w-full rounded-sm border border-white/[0.08] bg-black/30 px-3 text-xs"
          />
        </div>
        <label className="flex min-h-[44px] cursor-pointer items-start gap-2 text-xs text-foreground-muted">
          <input
            type="checkbox"
            checked={attestation}
            onChange={(e) => setAttestation(e.target.checked)}
            className="mt-1"
          />
          I am authorized to query this domain using passive public OSINT only.
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="button"
          disabled={busy || !domain.trim()}
          onClick={() => void runQuery()}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-sm border border-acid/30 bg-acid/10 px-4 text-xs uppercase tracking-wider text-acid disabled:opacity-50 sm:w-auto"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Run query
        </button>
      </div>

      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-foreground-subtle">
          Recent results
        </p>
        {loading ? (
          <p className="text-xs text-foreground-subtle">Loading…</p>
        ) : results.length === 0 ? (
          <p className="text-xs text-foreground-subtle">No queries yet — run your first OSINT lookup.</p>
        ) : (
          <ul className="space-y-3">
            {results.map((row) => (
              <ResultBody key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
