import { inviteMemberAction } from "@/lib/citadel/actions";
import { requireCitadelAccess } from "@/lib/citadel/access";
import { fetchRoster } from "@/lib/citadel/queries";

export const dynamic = "force-dynamic";

export default async function CitadelRosterPage() {
  const { member } = await requireCitadelAccess();
  const roster = await fetchRoster();
  const isCommander = member.role === "commander";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Agency Roster</h2>
        <p className="text-sm text-zinc-500">Compartment Zero members.</p>
      </header>

      {isCommander && (
        <form action={inviteMemberAction} className="flex flex-wrap gap-2 rounded-sm border border-white/[0.06] p-4">
          <input
            name="email"
            type="email"
            required
            placeholder="operator@example.com"
            className="min-w-[200px] flex-1 rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <select
            name="role"
            defaultValue="analyst"
            className="rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm"
          >
            <option value="analyst">Analyst</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            className="rounded-sm bg-cyan-500/20 px-4 py-2 text-xs uppercase text-cyan-300"
          >
            Invite
          </button>
        </form>
      )}

      <ul className="divide-y divide-white/[0.06] rounded-sm border border-white/[0.06]">
        {roster.map((m) => (
          <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-mono text-[10px] text-zinc-500">{m.user_id}</span>
            <span className="rounded-sm bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase text-cyan-300">
              {m.role}
            </span>
          </li>
        ))}
        {roster.length === 0 && (
          <li className="px-4 py-8 text-center text-zinc-500">No members.</li>
        )}
      </ul>
    </div>
  );
}
