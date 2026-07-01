import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseNoteForm } from "@/components/citadel/case-note-form";
import { runFusionIngestForCase } from "@/lib/citadel/actions";
import { fetchCaseDetail } from "@/lib/citadel/queries";

export const dynamic = "force-dynamic";

const ADMIRALTY_LABELS: Record<string, string> = {
  A: "A — Reliable",
  B: "B — Usually reliable",
  C: "C — Fairly reliable",
  D: "D — Not usually reliable",
  E: "E — Unreliable",
  F: "F — Cannot be judged",
};

export default async function CitadelCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { case: caseRow, entities, notes, timeline, corpusEvents } =
    await fetchCaseDetail(id);
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
        <h3 className="font-mono text-xs uppercase text-zinc-400">Case timeline</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {timeline.map((ev: { id: string; action: string; created_at: string; meta?: { source_reliability?: string } }) => (
            <li key={ev.id} className="flex justify-between gap-4 border-b border-white/[0.04] py-2">
              <span className="text-zinc-400">{ev.action}</span>
              <span className="font-mono text-[10px] text-zinc-600">
                {ev.meta?.source_reliability
                  ? ADMIRALTY_LABELS[ev.meta.source_reliability] ?? ev.meta.source_reliability
                  : new Date(ev.created_at).toLocaleString()}
              </span>
            </li>
          ))}
          {timeline.length === 0 && (
            <li className="text-zinc-500">No audit events yet.</li>
          )}
        </ul>
      </section>

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

      <section className="rounded-sm border border-white/[0.06] p-5">
        <h3 className="font-mono text-xs uppercase text-zinc-400">Analyst notes</h3>
        <CaseNoteForm caseId={id} />
        {notes.length > 0 && (
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
        )}
      </section>

      {corpusEvents.length > 0 && (
        <section className="rounded-sm border border-white/[0.06] p-5">
          <h3 className="font-mono text-xs uppercase text-zinc-400">Training corpus (redacted)</h3>
          <ul className="mt-4 space-y-2 text-xs text-zinc-500">
            {corpusEvents.map((c: { id: string; event_type: string; redacted_summary: string | null; created_at: string }) => (
              <li key={c.id}>
                <span className="text-cyan-600/80">{c.event_type}</span>
                {c.redacted_summary ? ` — ${c.redacted_summary}` : null}
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
