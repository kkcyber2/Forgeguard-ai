"use client";

import * as React from "react";
import { useTransition } from "react";
import { Trash2, RefreshCw, Loader2, History, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { deleteCustomAttackTool, publishApprovedToolToBazaar, resubmitCustomAttackTool } from "./actions";
import { DeveloperToolTester } from "./developer-tool-tester";

export interface DeveloperToolRow {
  id: string;
  name: string;
  family: string;
  intensity_min: string;
  status: string;
  network_allowed: boolean;
  audit_result: string | null;
  code: string;
  created_at: string;
  updated_at: string;
}

export interface ToolExecutionRow {
  id: string;
  tool_id: string;
  exit_code: number | null;
  stdout_preview: string | null;
  stderr_preview: string | null;
  created_at: string;
  scan_id: string | null;
}

function statusTone(status: string): React.ComponentProps<typeof Badge>["tone"] {
  switch (status) {
    case "approved":
      return "secure";
    case "pending":
      return "info";
    case "rejected":
      return "threat";
    case "disabled":
      return "warn";
    default:
      return "neutral";
  }
}

export function DeveloperToolList({
  tools,
  executionsByTool,
}: {
  tools: DeveloperToolRow[];
  executionsByTool: Record<string, ToolExecutionRow[]>;
}) {
  if (tools.length === 0) {
    return (
      <div className="rounded-sm border border-white/[0.06] bg-surface p-8 text-center">
        <p className="text-sm text-foreground-subtle">
          No tools authored yet. Submit your first probe above — it enters the sovereign audit queue.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-sm border border-white/[0.06] bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          <tr>
            <th className="px-4 py-3">Tool</th>
            <th className="px-4 py-3">Family</th>
            <th className="px-4 py-3">Intensity</th>
            <th className="px-4 py-3">Net</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Audit</th>
            <th className="px-4 py-3">Runs</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {tools.map((t) => (
            <ToolRow key={t.id} tool={t} executions={executionsByTool[t.id] ?? []} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolRow({
  tool,
  executions,
}: {
  tool: DeveloperToolRow;
  executions: ToolExecutionRow[];
}) {
  const [pending, start] = useTransition();
  const [testOpen, setTestOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const canResubmit = tool.status === "rejected" || tool.status === "disabled";
  const canPublish = tool.status === "approved";

  return (
    <>
      <tr className="border-t border-white/[0.04]">
        <td className="px-4 py-3">
          <div className="font-sans text-sm text-foreground">{tool.name}</div>
          <div className="text-[10px] text-foreground-subtle">
            {new Date(tool.created_at).toLocaleDateString()}
          </div>
        </td>
        <td className="px-4 py-3 uppercase">{tool.family}</td>
        <td className="px-4 py-3 uppercase">{tool.intensity_min}</td>
        <td className="px-4 py-3 uppercase">{tool.network_allowed ? "yes" : "no"}</td>
        <td className="px-4 py-3">
          <Badge tone={statusTone(tool.status)}>{tool.status}</Badge>
        </td>
        <td className="px-4 py-3 max-w-[200px] truncate text-foreground-subtle" title={tool.audit_result ?? ""}>
          {tool.audit_result ?? "—"}
        </td>
        <td className="px-4 py-3 text-foreground-subtle">
          {executions.length > 0 ? (
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-acid hover:underline"
            >
              <History size={11} />
              {executions.length}
            </button>
          ) : (
            "0"
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setTestOpen(true)}
              className={buttonStyles({ variant: "ghost", size: "sm" })}
              title="Test in sandbox"
            >
              Test
            </button>
            {canPublish ? (
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await publishApprovedToolToBazaar(tool.id);
                    if (!r.ok) alert(r.error);
                  })
                }
                className={buttonStyles({ variant: "ghost", size: "sm" })}
                title="Publish to Bazaar"
              >
                <Package size={13} strokeWidth={1.75} />
              </button>
            ) : null}
            {canResubmit ? (
              <button
                disabled={pending}
                onClick={() => start(async () => { await resubmitCustomAttackTool(tool.id); })}
                className={buttonStyles({ variant: "ghost", size: "sm" })}
                title="Resubmit for audit"
              >
                <RefreshCw size={13} strokeWidth={1.75} />
              </button>
            ) : null}
            <button
              disabled={pending}
              onClick={() => start(async () => { await deleteCustomAttackTool(tool.id); })}
              className={buttonStyles({ variant: "ghost", size: "sm" })}
              title="Delete tool"
            >
              {pending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} strokeWidth={1.75} className="text-threat" />
              )}
            </button>
          </div>
        </td>
      </tr>
      {historyOpen && executions.length > 0 ? (
        <tr className="border-t border-white/[0.04] bg-black/20">
          <td colSpan={8} className="px-4 py-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              Recent scan executions
            </p>
            <ul className="space-y-1.5">
              {executions.slice(0, 5).map((ex) => (
                <li key={ex.id} className="rounded-sm border border-white/[0.04] px-2 py-1.5 text-[11px]">
                  <span className={ex.exit_code === 0 ? "text-secure" : "text-threat"}>
                    exit {ex.exit_code ?? "?"}
                  </span>
                  <span className="text-foreground-subtle">
                    {" "}
                    · {new Date(ex.created_at).toLocaleString()}
                    {ex.scan_id ? ` · scan ${ex.scan_id.slice(0, 8)}…` : ""}
                  </span>
                  {ex.stdout_preview ? (
                    <pre className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap text-white/60">
                      {ex.stdout_preview.slice(0, 400)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
      {testOpen ? (
        <DeveloperToolTester
          initialCode={tool.code}
          initialNetwork={tool.network_allowed}
          open={testOpen}
          onOpenChange={setTestOpen}
          triggerLabel=""
        />
      ) : null}
    </>
  );
}
