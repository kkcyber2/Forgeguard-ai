"use client";

import Link from "next/link";
import { CheckCircle2, Lock, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIFFICULTY_LABEL,
  DIFFICULTY_TONE,
  type CtfChallenge,
  type CtfDifficulty,
} from "@/lib/ctf/types";

export function CtfList({
  challenges,
  solvedIds,
}: {
  challenges: CtfChallenge[];
  solvedIds: Set<string>;
}) {
  if (challenges.length === 0) {
    return (
      <p className="py-12 text-center font-mono text-sm text-white/40">
        No challenges published yet. Check back soon.
      </p>
    );
  }

  const totalPoints = challenges.reduce((s, c) => s + c.points, 0);
  const earned = challenges
    .filter((c) => solvedIds.has(c.id))
    .reduce((s, c) => s + c.points, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 font-mono text-[11px] text-white/50">
        <span>
          <span className="text-acid">{earned}</span> / {totalPoints} pts earned
        </span>
        <span>·</span>
        <span>
          {solvedIds.size} / {challenges.length} solved
        </span>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {challenges.map((c) => {
          const solved = solvedIds.has(c.id);
          const tone = DIFFICULTY_TONE[c.difficulty as CtfDifficulty] ?? DIFFICULTY_TONE.easy;
          return (
            <li key={c.id}>
              <Link
                href={`/dashboard/ctf/${c.slug}`}
                className={cn(
                  "block rounded-sm border p-5 transition-colors",
                  solved
                    ? "border-acid/25 bg-acid/[0.04]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-acid/25",
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase",
                      tone,
                    )}
                  >
                    {DIFFICULTY_LABEL[c.difficulty as CtfDifficulty] ?? c.difficulty}
                  </span>
                  <span className="font-mono text-[9px] text-white/40">{c.category}</span>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-acid">
                    {c.points} pts
                  </span>
                </div>

                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  {solved ? (
                    <CheckCircle2 size={14} className="shrink-0 text-acid" />
                  ) : (
                    <Lock size={14} className="shrink-0 text-white/40" />
                  )}
                  {c.title}
                </h2>

                <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-white/50">
                  {c.description_md}
                </p>

                <p className="mt-3 flex items-center gap-3 font-mono text-[9px] text-white/30">
                  <span className="inline-flex items-center gap-1">
                    <Users size={10} /> {c.solves} solved
                  </span>
                  {solved ? (
                    <span className="inline-flex items-center gap-1 text-acid">
                      <Target size={10} /> Cleared
                    </span>
                  ) : null}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
