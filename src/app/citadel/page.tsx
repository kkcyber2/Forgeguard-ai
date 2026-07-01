import Link from "next/link";
import { createCaseAction } from "@/lib/citadel/actions";
import { fetchCitadelDashboard } from "@/lib/citadel/queries";

export const dynamic = "force-dynamic";

export default async function CitadelDashboardPage() {
  const data = await fetchCitadelDashboard();

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-xl font-semibold text-zinc-100">Fusion Dashboard</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Agency compartment intelligence — cases, entities, and audit trail.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Cases", value: data.cases.length },
          { label: "Entities", value: data.entities.length },
          { label: "Tasks", value: data.tasks.length },
          { label: "Leads", value: data.leadsCount },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              {kpi.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-cyan-300">
              {kpi.value}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            New case
          </h3>
          <form action={createCaseAction} className="mt-4 space-y-3">
            <input
              name="title"
              required
              placeholder="Case title"
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm"
            />
            <input
              name="target_domain"
              placeholder="target.example.com"
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm"
            />
            <select
              name="priority"
              defaultValue="medium"
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <button
              type="submit"
              className="rounded-sm bg-cyan-500/20 px-4 py-2 text-xs font-medium uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/30"
            >
              Open case
            </button>
          </form>
        </div>

        <div className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            Recent audit
          </h3>
          <ul className="mt-4 space-y-2 text-xs text-zinc-400">
            {data.auditEvents.length === 0 && <li>No events yet.</li>}
            {data.auditEvents.map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span className="text-zinc-300">{e.action}</span>
                <time className="shrink-0 font-mono text-[10px] text-zinc-600">
                  {new Date(e.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
          Active cases
        </h3>
        <ul className="mt-4 divide-y divide-white/[0.04]">
          {data.cases.length === 0 && (
            <li className="py-4 text-sm text-zinc-500">No cases opened yet.</li>
          )}
          {data.cases.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <div>
                <Link
                  href={`/citadel/cases/${c.id}`}
                  className="text-sm text-cyan-300 hover:underline"
                >
                  {c.title}
                </Link>
                <p className="font-mono text-[10px] text-zinc-600">
                  {c.target_domain ?? "—"} · {c.status} · {c.priority}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
