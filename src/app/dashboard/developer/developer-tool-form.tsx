"use client";

import * as React from "react";
import { useActionState } from "react";
import { Boxes, Sparkles, Loader2 } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { buttonStyles } from "@/components/ui/button";
import {
  createCustomAttackTool,
  TOOL_FAMILIES,
  TOOL_INTENSITIES,
  type ToolFormState,
} from "./actions";

const inputClass =
  "flex w-full rounded-sm bg-obsidian-800/70 px-3 py-2 text-sm border-hairline border-white/10 text-foreground placeholder:text-foreground-subtle focus:border-acid/60 focus:bg-obsidian-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-acid/40";

const initial: ToolFormState = { ok: false };

export function DeveloperToolForm() {
  const [state, formAction, pending] = useActionState(createCustomAttackTool, initial);
  const verdict = state.verdict;

  return (
    <form action={formAction} className="rounded-sm border border-white/[0.06] bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <Boxes size={12} strokeWidth={1.75} className="text-foreground-subtle" />
        <p className="text-eyebrow text-foreground-subtle">Author a custom attack tool</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Tool name</Label>
          <Input id="name" name="name" placeholder="e.g. jwt-confusion-probe" maxLength={80} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="family">Family</Label>
            <select id="family" name="family" className={inputClass} defaultValue="web">
              {TOOL_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="intensity_min">Intensity floor</Label>
            <select id="intensity_min" name="intensity_min" className={inputClass} defaultValue="aggressive">
              {TOOL_INTENSITIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Label htmlFor="code">Tool source (Python)</Label>
        <textarea
          id="code"
          name="code"
          required
          spellCheck={false}
          minLength={10}
          maxLength={50_000}
          placeholder={
            "async def run(ctx, target):\n" +
            "    # ctx has: llm, http, log, target_url, intensity\n" +
            "    return {\"finding\": None}\n"
          }
          className={`${inputClass} h-56 font-mono text-xs leading-relaxed resize-y`}
        />
        <p className="mt-1.5 text-[11px] text-foreground-subtle">
          Executed inside the Agathon Docker sandbox. Approved tools become callable by the
          Brain via <code className="font-mono">run_operator_tool</code>.
        </p>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-foreground-muted">
        <input type="checkbox" name="network_allowed" className="h-4 w-4 accent-acid" />
        Network access permitted (probes that contact the target)
      </label>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonStyles({ variant: "primary", size: "sm" })}
        >
          {pending ? <Loader2 size={13} strokeWidth={1.75} className="animate-spin" /> : <Sparkles size={13} strokeWidth={1.75} />}
          Submit for audit
        </button>

        {state.error ? (
          <p className="text-xs text-threat">{state.error}</p>
        ) : state.ok ? (
          <p className="text-xs text-acid">
            Submitted — audit pre-screen: <span className="font-mono">{state.auditSummary}</span>
          </p>
        ) : null}
      </div>

      {state.ok && verdict ? (
        <p className="mt-2 text-[11px] text-foreground-subtle">
          A sovereign admin reviews every submission in the Developer Tools audit queue before it
          becomes runnable. Risk floor: <span className="font-mono">{state.riskScore}/100</span> ·{" "}
          verdict: <span className="font-mono">{verdict}</span>.
        </p>
      ) : null}
    </form>
  );
}
