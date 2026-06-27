import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crosshair, Lightbulb, Users } from "lucide-react";
import { fetchChallengeBySlug, fetchUserSolves } from "@/lib/ctf/queries";
import {
  DIFFICULTY_LABEL,
  DIFFICULTY_TONE,
  type CtfDifficulty,
} from "@/lib/ctf/types";
import { CtfChallengeForm } from "@/components/ctf/ctf-challenge-form";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function CtfChallengePage({ params }: Props) {
  const { slug } = await params;
  const [challenge, solves] = await Promise.all([
    fetchChallengeBySlug(slug),
    fetchUserSolves(),
  ]);

  if (!challenge) notFound();

  const alreadySolved = solves.has(challenge.id);
  const tone =
    DIFFICULTY_TONE[challenge.difficulty as CtfDifficulty] ?? DIFFICULTY_TONE.easy;

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <Link
        href="/dashboard/ctf"
        className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-white/40 hover:text-white/70"
      >
        <ArrowLeft size={13} />
        ForgeGrounds
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase",
            tone,
          )}
        >
          {DIFFICULTY_LABEL[challenge.difficulty as CtfDifficulty] ?? challenge.difficulty}
        </span>
        <span className="font-mono text-[9px] text-white/40">{challenge.category}</span>
        <span className="font-mono text-[10px] tabular-nums text-acid">
          {challenge.points} pts
        </span>
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] text-white/30">
          <Users size={10} /> {challenge.solves} solved
        </span>
      </div>

      <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
        <Crosshair size={18} className="text-acid" />
        {challenge.title}
      </h1>
      <p className="mt-2 text-sm text-white/55">{challenge.description_md}</p>

      <section className="mt-6 rounded-sm border border-white/[0.08] bg-black/30 p-5">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Target prompt
        </h2>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-sm border border-white/[0.06] bg-black/40 p-4 font-mono text-[12px] leading-relaxed text-white/75">
          {challenge.prompt}
        </pre>
      </section>

      {challenge.hint ? (
        <section className="mt-4 flex items-start gap-2 rounded-sm border border-amber-400/20 bg-amber-400/[0.05] p-4">
          <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-[12px] leading-relaxed text-amber-200/80">
            <span className="font-mono text-[10px] uppercase tracking-wider">
              Hint ·{" "}
            </span>
            {challenge.hint}
          </p>
        </section>
      ) : null}

      <section className="mt-6 rounded-sm border border-white/[0.08] bg-white/[0.02] p-5">
        <CtfChallengeForm
          challengeId={challenge.id}
          alreadySolved={alreadySolved}
          points={challenge.points}
        />
      </section>
    </div>
  );
}
