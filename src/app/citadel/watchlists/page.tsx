import { createWatchlistAction, runWatchlistAction } from "@/lib/citadel/actions";
import { fetchWatchlistsWithItems } from "@/lib/citadel/queries";

export const dynamic = "force-dynamic";

export default async function CitadelWatchlistsPage() {
  const watchlists = await fetchWatchlistsWithItems();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Watchlists</h2>
        <p className="text-sm text-zinc-500">Monitor domains and re-run fusion ingest.</p>
      </header>

      <form action={createWatchlistAction} className="flex flex-wrap gap-2">
        <input
          name="name"
          required
          placeholder="Watchlist name"
          className="rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-sm bg-cyan-500/20 px-4 py-2 text-xs uppercase text-cyan-300"
        >
          Create
        </button>
      </form>

      <ul className="space-y-4">
        {watchlists.map((w) => (
          <li
            key={w.id}
            className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-zinc-200">{w.name}</h3>
                <p className="font-mono text-[10px] text-zinc-600">
                  {w.items.length} items
                  {w.last_run_at
                    ? ` · last run ${new Date(w.last_run_at).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <form
                action={async () => {
                  "use server";
                  await runWatchlistAction(w.id);
                }}
              >
                <button
                  type="submit"
                  className="rounded-sm border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.04]"
                >
                  Run
                </button>
              </form>
            </div>
            {w.items.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {w.items.map((item: { id: string; raw_value: string }) => (
                  <li
                    key={item.id}
                    className="rounded-sm bg-black/40 px-2 py-1 font-mono text-[10px] text-zinc-400"
                  >
                    {item.raw_value}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {watchlists.length === 0 && (
          <p className="text-sm text-zinc-500">No watchlists yet.</p>
        )}
      </ul>
    </div>
  );
}
