import { OperatorLeaderboard } from "@/components/dashboard/operator-leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function IntelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">{children}</div>
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-[4px] border-[0.5px] border-white/[0.08] bg-[#050505]/90 p-4 backdrop-blur-md">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-zinc-500">
            Operator Leaderboard
          </p>
          <OperatorLeaderboard limit={10} />
        </div>
      </aside>
    </div>
  );
}
