/**
 * Build ordered attack replay steps from scan_logs + report attack_path.
 */

export interface ReplayStep {
  id: string;
  phase: "recon" | "strike" | "breach" | "thought" | "report";
  title: string;
  detail: string;
  severity: string;
  at: string;
}

export interface ReplayLogRow {
  id: number;
  type: string;
  severity: string;
  attack_name: string | null;
  payload: unknown;
  created_at: string;
}

function payloadText(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload.slice(0, 280);
  if (typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const msg = o.message ?? o.thought ?? o.summary ?? o.probe;
    if (typeof msg === "string") return msg.slice(0, 280);
    try {
      return JSON.stringify(payload).slice(0, 280);
    } catch {
      return "";
    }
  }
  return String(payload).slice(0, 280);
}

function mapLogPhase(type: string): ReplayStep["phase"] | null {
  const t = type.toLowerCase();
  if (t === "breach") return "breach";
  if (t === "strike" || t === "attempt") return "strike";
  if (t === "thought" || t === "brain_decision") return "thought";
  if (t === "finding" || t === "report") return "report";
  if (t === "info" || t === "progress") return "recon";
  return null;
}

export function buildAttackReplaySteps(
  logs: ReplayLogRow[],
  attackPath: unknown[] | null | undefined,
): ReplayStep[] {
  const steps: ReplayStep[] = [];
  const chronological = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const log of chronological) {
    const phase = mapLogPhase(log.type);
    if (!phase || phase === "recon") continue;

    steps.push({
      id: `log-${log.id}`,
      phase,
      title: log.attack_name ?? log.type,
      detail: payloadText(log.payload),
      severity: log.severity,
      at: log.created_at,
    });
  }

  if (Array.isArray(attackPath)) {
    attackPath.forEach((item, i) => {
      if (!item || typeof item !== "object") return;
      const row = item as Record<string, unknown>;
      steps.push({
        id: `path-${i}`,
        phase: "report",
        title: String(row.title ?? row.step ?? row.action ?? `Step ${i + 1}`),
        detail: String(row.description ?? row.rationale ?? row.result ?? "").slice(0, 280),
        severity: String(row.severity ?? "medium"),
        at: String(row.timestamp ?? row.at ?? ""),
      });
    });
  }

  if (steps.length === 0 && chronological.length > 0) {
    const last = chronological[chronological.length - 1]!;
    steps.push({
      id: `fallback-${last.id}`,
      phase: "recon",
      title: last.attack_name ?? "Scan activity",
      detail: payloadText(last.payload) || "Attack sequence recorded.",
      severity: last.severity,
      at: last.created_at,
    });
  }

  return steps;
}
