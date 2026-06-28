"use client";

import * as React from "react";
import { useTransition } from "react";
import { Check, X, Ban, Loader2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonStyles } from "@/components/ui/button";
import { approveCustomAttackTool, rejectCustomAttackTool, disableCustomAttackTool } from "./actions";

export interface AuditToolRow {
  id: string;
  name: string;
  family: string;
  intensity_min: string;
  status: string;
  network_allowed: boolean;
  audit_result: string | null;
  code: string;
  created_at: string;
  author_email?: string | null;
  author_name?: string | null;
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

export function AuditQueue({ tools }: { tools: AuditToolRow[] }) {
  if (tools.length === 0) {
    return (
      <div className="rounded-sm border border-white/[0.06] bg-surface p-8 text-center">
        <p className="text-sm text-foreground-subtle">
          No custom attack tools submitted yet. The developer console is the entry point.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tools.map((t) => (
        <AuditCard key={t.id} tool={t} />
      ))}
    </div>
  );
}

function AuditCard({ tool }: { tool: AuditToolRow }) {
  const [pending, start] = useTransition();
  const [reason, setReason] = React.useState("");
  const [open, setOpen] = React.useState(tool.status === "pending");

  return (
    <div className="rounded-sm border border-white/[0.06] bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="font-sans text-sm text-foreground">{tool.name}</p>
          <p className="font-mono text-[10px] text-foreground-subtle">
            {tool.family} · {tool.intensity_min} · net={tool.network_allowed ? "yes" : "no"} ·{" "}
            {new Date(tool.created_at).toLocaleString()}
            {tool.author_name ? ` · ${tool.author_name}` : ""}
            {tool.author_email ? ` <${tool.author_email}>` : ""}
          </p>
        </div>
        <Badge tone={statusTone(tool.status)} className="ml-auto">
          {tool.status}
        </Badge>
        <button
          onClick={() => setOpen((o) => !o)}
          className={buttonStyles({ variant: "ghost", size: "sm" })}
        >
          <ChevronDown
            size={13}
            strokeWidth={1.75}
            className={open ? "rotate-180 transition-transform" : "transition-transform"}
          />
          {open ? "Hide" : "Review"}
        </button>
      </div>

      <p className="mt-3 text-[11px] text-foreground-subtle">
        <span className="font-mono">audit:</span> {tool.audit_result ?? "—"}
      </p>

      {open ? (
        <>
          <pre className="mt-3 max-h-72 overflow-auto rounded-sm bg-obsidian-900/80 p-3 font-mono text-[11px] leading-relaxed text-foreground-muted whitespace-pre-wrap break-all">
            {tool.code}
          </pre>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              disabled={pending || tool.status === "approved"}
              onClick={() => start(async () => { await approveCustomAttackTool(tool.id); })}
              className={buttonStyles({ variant: "primary", size: "sm" })}
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={1.75} />}
              Approve
            </button>

            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reject reason (shown to author)"
              className="h-9 max-w-xs"
            />
            <button
              disabled={pending || tool.status === "rejected"}
              onClick={() => start(async () => { await rejectCustomAttackTool(tool.id, reason); })}
              className={buttonStyles({ variant: "danger", size: "sm" })}
            >
              <X size={13} strokeWidth={1.75} />
              Reject
            </button>

            {tool.status === "approved" ? (
              <button
                disabled={pending}
                onClick={() => start(async () => { await disableCustomAttackTool(tool.id); })}
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                <Ban size={13} strokeWidth={1.75} />
                Disable
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
