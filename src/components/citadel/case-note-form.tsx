"use client";

import { addCaseNoteAction } from "@/lib/citadel/actions";

export function CaseNoteForm({ caseId }: { caseId: string }) {
  return (
    <form action={addCaseNoteAction} className="mt-4 space-y-2">
      <input type="hidden" name="caseId" value={caseId} />
      <textarea
        name="body"
        rows={3}
        required
        minLength={3}
        maxLength={4000}
        placeholder="Analyst note (markdown)…"
        className="w-full rounded-sm border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-zinc-300"
      />
      <button
        type="submit"
        className="rounded-sm border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs uppercase tracking-wider text-cyan-300"
      >
        Add note
      </button>
    </form>
  );
}
