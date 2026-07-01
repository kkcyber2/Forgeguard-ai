import Link from "next/link";
import { notFound } from "next/navigation";
import { runFusionIngestForCase } from "@/lib/citadel/actions";
import { fetchCaseDetail } from "@/lib/citadel/queries";

export const dynamic = "force-dynamic";

export default async function CitadelCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { case: caseRow, entities, notes } = await fetchCaseDetail(id);
  if (!caseRow) notFound();

  return (
    <div className="space-y-6">
      <Link href="/citadel" className="text-xs text-zinc-500 hover:text-cyan-300">
        ← Fusion dashboard
      </Link>
      <header>
        <h2 className="text-xl font-semibold">{caseRow.title}</h2>
        <p className="mt-1 font-mono text-xs text-zinc-500">
          {caseRow.target_domain ?? "no target"} · {caseRow.status} · {caseRow.priority}
        </p>
      </header>

      {caseRow.target_domain && (
        <form action={runFusionIngestForCase}>
          <input type="hidden" name="caseId" value={id} />
          <button
            type="submit"
            className="rounded-sm border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs uppercase tracking-wider text-cyan-300"
          >
            Run fusion ingest
          </button>
        </form>
      )}

      <section className="rounded-sm border border-white/[0.06] p-5">
        <h3 className="font-mono text-xs uppercase text-zinc-400">Entities ({entities.length})</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {entities.map((e) => (
            <li key={e.id} className="flex justify-between gap-4 border-b border-white/[0.04] py-2">
              <span className="font-mono text-cyan-200/90">{e.value}</span>
              <span className="text-xs text-zinc-500">
                {e.entity_type} · {(e.confidence * 100).toFixed(0)}%
              </span>
            </li>
          ))}
          {entities.length === 0 && (
            <li className="text-zinc-500">No entities ingested yet.</li>
          )}
        </ul>
      </section>

      {notes.length > 0 && (
        <section className="rounded-sm border border-white/[0.06] p-5">
          <h3 className="font-mono text-xs uppercase text-zinc-400">Notes</h3>
          <ul className="mt-4 space-y-3 text-sm text-zinc-400">
            {notes.map((n: { id: string; body_md: string; created_at: string }) => (
              <li key={n.id}>
                <p>{n.body_md}</p>
                <time className="font-mono text-[10px] text-zinc-600">
                  {new Date(n.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-zinc-600">
        STIX export:{" "}
        <a href={`/api/citadel/cases/${id}/stix`} className="text-cyan-500 hover:underline">
          /api/citadel/cases/{id}/stix
        </a>
      </p>
    </div>
  );
}
