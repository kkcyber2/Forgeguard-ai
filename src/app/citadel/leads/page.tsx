import { fetchLeads } from "@/lib/citadel/queries";

export const dynamic = "force-dynamic";

export default async function CitadelLeadsPage() {
  const leads = await fetchLeads(100);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">War Machine Leads</h2>
        <p className="text-sm text-zinc-500">Agency-only pipeline view.</p>
      </header>

      <div className="overflow-x-auto rounded-sm border border-white/[0.06]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Website</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-zinc-200">{lead.company_name}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {lead.website_url ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs">{lead.status}</td>
                <td className="px-4 py-3 text-xs">{lead.rank}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{lead.source}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No leads visible (RLS or empty pipeline).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
