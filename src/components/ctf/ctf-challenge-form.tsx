import * as React from "react";
import { Target, Flag as FlagIcon, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CtfVerifyResponse } from "@/lib/ctf/types";

/**
 * CTF flag submission form. Calls /api/ctf/verify and surfaces the
 * solved / already_solved / wrong status returned by the
 * submit_ctf_flag SECURITY DEFINER RPC.
 */
export function CtfChallengeForm({
  challengeId,
  alreadySolved,
  points,
}: {
  challengeId: string;
  alreadySolved: boolean;
  points: number;
}) {
  const [flag, setFlag] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<CtfVerifyResponse | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!flag.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/ctf/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, flag: flag.trim() }),
      });
      const json = (await res.json()) as CtfVerifyResponse;
      setResult(json);
      if (json.status === "solved") setFlag("");
    } catch {
      setResult({ ok: false, error: "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  if (alreadySolved) {
    return (
      <div className="flex items-center gap-3 rounded-sm border border-acid/25 bg-acid/[0.05] px-4 py-3">
        <CheckCircle2 size={16} className="text-acid" />
        <p className="font-mono text-[11px] uppercase tracking-wider text-acid">
          Already cleared · +{points} pts banked
        </p>
      </div>
    );
  }

  const solved = result?.status === "solved";
  const wrong = result?.status === "wrong";

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block font-mono text-[10px] uppercase tracking-wider text-white/40">
        Submit flag
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <FlagIcon
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            placeholder="fg{...}"
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            className="min-h-[44px] w-full rounded-sm border border-white/[0.08] bg-black/40 py-2.5 pl-9 pr-3 font-mono text-sm text-white placeholder:text-white/25"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !flag.trim()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-acid/30 bg-acid/10 px-5 font-mono text-[11px] uppercase tracking-wider text-acid disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
          {busy ? "Verifying…" : "Verify"}
        </button>
      </div>

      {solved && (
        <p className="flex items-center gap-2 font-mono text-[11px] text-acid">
          <CheckCircle2 size={12} /> Solved · +{result?.points ?? points} pts ·{" "}
          {result?.total_solves ?? 0} total solves
        </p>
      )}
      {wrong && (
        <p className="flex items-center gap-2 font-mono text-[11px] text-threat">
          <XCircle size={12} /> Incorrect flag — try again.
        </p>
      )}
      {result?.ok === false && result.error && (
        <p className={cn("font-mono text-[11px] text-threat")}>{result.error}</p>
      )}
    </form>
  );
}
