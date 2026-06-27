import Link from "next/link";
import { ArrowLeft, Crosshair } from "lucide-react";
import { fetchPublishedChallenges, fetchUserSolves } from "@/lib/ctf/queries";
import { CtfList } from "@/components/ctf/ctf-list";

export const dynamic = "force-dynamic";

export default async function CtfIndexPage() {
  const [challenges, solves] = await Promise.all([
    fetchPublishedChallenges(),
    fetchUserSolves(),
  ]);

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-white/40 hover:text-white/70"
      >
        <ArrowLeft size={13} />
        Dashboard
      </Link>

      <div className="mb-8 flex items-center gap-2">
        <Crosshair size={16} className="text-acid" />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-acid">
            ForgeGrounds · CTF
          </p>
          <h1 className="text-2xl font-semibold text-white">Adversarial Labs</h1>
          <p className="mt-1 max-w-xl text-sm text-white/45">
            Leaderboard-style LLM red-team challenges. Capture the flag on each
            lab to bank reputation points. No live target is contacted — these
            are static prompt-injection / jailbreak exercises.
          </p>
        </div>
      </div>

      <CtfList challenges={challenges} solvedIds={new Set(solves.keys())} />
    </div>
  );
}
