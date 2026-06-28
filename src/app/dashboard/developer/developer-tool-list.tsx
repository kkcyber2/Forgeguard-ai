"use client";

import * as React from "react";
import { useTransition } from "react";
import { Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { deleteCustomAttackTool, resubmitCustomAttackTool } from "./actions";

export interface DeveloperToolRow {
  id: string;
  name: string;
  family: string;
  intensity_min: string;
  status: string;
  network_allowed: boolean;
  audit_result: string | null;
  created_at: string;
  updated_at: string;
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

export function DeveloperToolList({ tools }: { tools: DeveloperToolRow[] }) {
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
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {tools.map((t) => (
            <ToolRow key={t.id} tool={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolRow({ tool }: { tool: DeveloperToolRow }) {
  const [pending, start] = useTransition();
  const canResubmit = tool.status === "rejected" || tool.status === "disabled";

  return (
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
      <td className="px-4 py-3 max-w-[260px] truncate text-foreground-subtle" title={tool.audit_result ?? ""}>
        {tool.audit_result ?? "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
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
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} strokeWidth={1.75} className="text-threat" />}
          </button>
        </div>
      </td>
    </tr>
  );
}
