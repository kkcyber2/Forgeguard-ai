"use client";

import { useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { grantSovereignAccess } from "./actions";

export function GrantAccessButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void grantSovereignAccess(userId))}
      className="flex items-center gap-1.5 rounded-[3px] border-[0.5px] border-violet-400/40 bg-violet-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-violet-300 hover:bg-violet-500/15 disabled:opacity-40"
    >
      {pending ? (
        <Loader2 size={11} className="animate-spin" />
      ) : (
        <ShieldCheck size={11} />
      )}
      Grant access
    </button>
  );
}
