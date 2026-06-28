"use client";

import * as React from "react";
import { useActionState } from "react";
import { Boxes, Sparkles, Loader2 } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { buttonStyles } from "@/components/ui/button";
import { PROBE_TEMPLATE } from "@/lib/developer/probe-template";
import {
  createCustomAttackTool,
  TOOL_FAMILIES,
  TOOL_INTENSITIES,
  type ToolFormState,
} from "./actions";
import { DeveloperToolTester } from "./developer-tool-tester";

const inputClass =
  "flex w-full rounded-sm bg-obsidian-800/70 px-3 py-2 text-sm border-hairline border-white/10 text-foreground placeholder:text-foreground-subtle focus:border-acid/60 focus:bg-obsidian-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-acid/40";

const initial: ToolFormState = { ok: false };

export function DeveloperToolForm() {
  const [state, formAction, pending] = useActionState(createCustomAttackTool, initial);
  const [code, setCode] = React.useState(PROBE_TEMPLATE);
  const [networkAllowed, setNetworkAllowed] = React.useState(false);
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
        <div className="mb-1.5 flex items-center justify-between">
          <Label htmlFor="code">Tool source (Python probe.py)</Label>
          <button
            type="button"
            onClick={() => setCode(PROBE_TEMPLATE)}
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            Use template
          </button>
        </div>
        <textarea
          id="code"
          name="code"
          required
          spellCheck={false}
          minLength={10}
          maxLength={50_000}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${inputClass} h-56 font-mono text-xs leading-relaxed resize-y`}
        />
        <p className="mt-1.5 text-[11px] text-foreground-subtle">
          Runs as <code className="font-mono">python3 probe.py</code> in Docker with env vars{" "}
          <code className="font-mono">TARGET_URL</code>,{" "}
          <code className="font-mono">TARGET_MODEL</code>,{" "}
          <code className="font-mono">TARGET_API_KEY</code>. Approved tools are invoked by the Brain
          via <code className="font-mono">run_operator_tool(name)</code>.
        </p>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-foreground-muted">
        <input
          type="checkbox"
          name="network_allowed"
          checked={networkAllowed}
          onChange={(e) => setNetworkAllowed(e.target.checked)}
          className="h-4 w-4 accent-acid"
        />
        Network access permitted (probes that contact the target)
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonStyles({ variant: "primary", size: "sm" })}
        >
          {pending ? <Loader2 size={13} strokeWidth={1.75} className="animate-spin" /> : <Sparkles size={13} strokeWidth={1.75} />}
          Submit for audit
        </button>

        <DeveloperToolTester
          initialCode={code}
          initialNetwork={networkAllowed}
          triggerLabel="Test in sandbox"
        />

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
