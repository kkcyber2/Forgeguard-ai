import Link from "next/link";
import { Radar } from "lucide-react";
import { listVaultResultsForScan } from "@/lib/intel/vault-actions";

interface Props {
  scanId: string;
}

export async function ScanReconContext({ scanId }: Props) {
  const rows = await listVaultResultsForScan(scanId);
  if (rows.length === 0) return null;

  return (
    <section className="mt-6 rounded-sm border border-white/[0.06] bg-obsidian-800/40 p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radar size={14} className="text-acid" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-acid">
            Recon context
          </span>
        </div>
        <Link
          href="/dashboard/intel"
          className="font-mono text-[10px] text-foreground-subtle hover:text-acid"
        >
          Intel Vault →
        </Link>
      </div>
      <p className="mb-3 text-xs text-foreground-subtle">
        Legal OSINT queries linked to this scan from the Intel Vault.
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-sm border border-white/[0.06] bg-black/20 px-3 py-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase text-acid">{r.query_type}</span>
              <span className="font-mono text-foreground">{r.target_domain}</span>
              <time className="ml-auto font-mono text-[10px] text-foreground-subtle">
                {new Date(r.created_at).toLocaleString()}
              </time>
            </div>
            {r.error_message ? (
              <p className="mt-1 text-red-400">{r.error_message}</p>
            ) : (
              <p className="mt-1 line-clamp-2 font-mono text-[10px] text-foreground-muted">
                {typeof r.result.content === "string"
                  ? r.result.content.slice(0, 200)
                  : JSON.stringify(r.result).slice(0, 200)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
