"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { completeMission } from "./actions";

export function CompleteMissionButton({ missionId }: { missionId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void completeMission(missionId))}
      className="flex items-center gap-2 rounded-[3px] border-[0.5px] border-[#D1FF00]/40 bg-[#D1FF00]/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#D1FF00] transition-all hover:bg-[#D1FF00]/20 disabled:opacity-50"
    >
      <CheckCircle2 size={12} strokeWidth={2} />
      {pending ? "Releasing…" : "Approve & Release Funds"}
    </button>
  );
}
