"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { FlaskConical, Loader2, X } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SandboxTestResult {
  ok: boolean;
  exit_code: number;
  stdout: string;
  stderr_tail: string;
  error?: string;
}

interface DeveloperToolTesterProps {
  initialCode: string;
  initialNetwork?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
  /** Controlled open (optional) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeveloperToolTester({
  initialCode,
  initialNetwork = true,
  triggerLabel = "Test in sandbox",
  triggerClassName,
  open: controlledOpen,
  onOpenChange,
}: DeveloperToolTesterProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [code, setCode] = useState(initialCode);
  const [networkAllowed, setNetworkAllowed] = useState(initialNetwork);
  const [targetUrl, setTargetUrl] = useState("https://example.com");
  const [result, setResult] = useState<SandboxTestResult | null>(null);
  const [pending, start] = useTransition();

  React.useEffect(() => {
    if (open) {
      setCode(initialCode);
      setNetworkAllowed(initialNetwork);
      setResult(null);
    }
  }, [open, initialCode, initialNetwork]);

  function runTest() {
    start(async () => {
      setResult(null);
      try {
        const resp = await fetch("/api/developer/test-tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, networkAllowed, targetUrl }),
        });
        const data = (await resp.json()) as SandboxTestResult & { error?: string };
        if (!resp.ok) {
          setResult({
            ok: false,
            exit_code: data.exit_code ?? -1,
            stdout: data.stdout ?? "",
            stderr_tail: data.stderr_tail ?? "",
            error: data.error ?? "Sandbox test failed",
          });
          return;
        }
        setResult(data);
      } catch (e) {
        setResult({
          ok: false,
          exit_code: -1,
          stdout: "",
          stderr_tail: "",
          error: e instanceof Error ? e.message : "Request failed",
        });
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonStyles({ variant: "secondary", size: "sm" }), triggerClassName)}
      >
        <FlaskConical size={13} strokeWidth={1.75} />
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-sm border border-white/[0.08] bg-obsidian-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              Developer · Sandbox dry-run
            </p>
            <p className="text-sm text-foreground">Same Docker path as run_operator_tool</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonStyles({ variant: "ghost", size: "sm" })}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              Target URL (TARGET_URL env)
            </label>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="mt-1 w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-foreground"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground-muted">
            <input
              type="checkbox"
              checked={networkAllowed}
              onChange={(e) => setNetworkAllowed(e.target.checked)}
              className="h-4 w-4 accent-acid"
            />
            Network access permitted
          </label>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="h-48 w-full resize-y rounded-sm border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed text-foreground"
          />

          {result ? (
            <div className="space-y-2 rounded-sm border border-white/[0.06] bg-black/30 p-3">
              <p
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.12em]",
                  result.ok ? "text-secure" : "text-threat",
                )}
              >
                exit {result.exit_code} · {result.ok ? "PASS" : "FAIL"}
                {result.error ? ` · ${result.error}` : ""}
              </p>
              {result.stdout ? (
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-white/80">
                  {result.stdout}
                </pre>
              ) : null}
              {result.stderr_tail ? (
                <pre className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-threat/80">
                  {result.stderr_tail}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
          <button type="button" onClick={() => setOpen(false)} className={buttonStyles({ variant: "ghost", size: "sm" })}>
            Close
          </button>
          <button
            type="button"
            disabled={pending || code.length < 10}
            onClick={runTest}
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
            Run probe
          </button>
        </div>
      </div>
    </div>
  );
}
