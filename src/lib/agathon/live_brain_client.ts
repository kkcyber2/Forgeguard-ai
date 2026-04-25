import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Agathon — Live Brain client (Vercel side).
 * ------------------------------------------
 *
 * This module is the Vercel-side counterpart to `agathon/orchestrator.py`.
 *
 * The orchestrator runs the *autonomous* Brain on Railway — that loop is
 * stateful, long-running, and never talks directly to the user. THIS file
 * is the *interactive* Brain: a chat surface the operator opens in the
 * dashboard while the scan is running, asking "what's happening?", "skip
 * the next attack", "why did this finding fire?".
 *
 * Two reasons it's a separate path:
 *
 *   1. Vercel's serverless runtime caps individual function executions at
 *      ~300s, but a chat turn is short-lived and well within that cap.
 *      Keeping the chat on Vercel means we don't have to expose the
 *      Railway worker's WebSocket to authenticated browser sessions.
 *
 *   2. Context budget. The orchestrator Brain has *full* tool access.
 *      The chat Brain only needs a compressed picture of what's happening
 *      so it can answer questions — feeding it the raw scan_logs (which
 *      can run to 5–20k tokens per scan) would burn budget for no gain.
 *      `buildContextDigest()` distils that down to ~30 lines.
 *
 * Public surface:
 *   - buildContextDigest({scanId, supabase}) -> ContextDigest
 *       Pure read; safe to call from any server boundary that has a
 *       Supabase client (RLS-scoped is fine — the user can only see
 *       their own scans anyway).
 *
 *   - streamChatTurn({digest, userMessage, history}) -> AsyncIterable<ChatChunk>
 *       Wraps the Anthropic streaming SDK. The route handler at
 *       /api/agathon/chat just iterates and pumps SSE frames.
 *
 *   - LiveBrainConfig
 *       Centralised model/tier knobs so we can hot-swap Sonnet ↔ Haiku
 *       without grepping for model strings.
 */

// --------------------------------------------------------------------------- //
// Types                                                                       //
// --------------------------------------------------------------------------- //

type ScanRow = Database["public"]["Tables"]["scans"]["Row"];
type ScanLogRow = Database["public"]["Tables"]["scan_logs"]["Row"];

export interface ContextDigest {
  /** The compressed text fed to Claude as the system-context block. */
  text: string;
  /** Number of scan_logs rows the digest is built from. */
  rowsConsidered: number;
  /** Severities present, used by the UI to colour the chat header. */
  severityCounts: Record<"info" | "low" | "medium" | "high" | "critical", number>;
  /** Snapshot of the scan row at digest time. */
  scan: Pick<
    ScanRow,
    "id" | "status" | "progress_pct" | "target_model" | "target_url"
  >;
}

export interface ChatHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export type ChatChunk =
  | { kind: "text"; delta: string }
  | { kind: "usage"; input_tokens: number; output_tokens: number }
  | { kind: "error"; message: string }
  | { kind: "done"; stop_reason: string | null };

export interface LiveBrainConfig {
  /** Anthropic model id. Defaults to Sonnet for the chat surface. */
  model: string;
  /** Sampling temp for the chat persona. Lower = more factual. */
  temperature: number;
  /** Max output tokens per turn. */
  maxTokens: number;
  /** How many scan_logs rows to pull when building the digest. */
  digestRows: number;
}

export const DEFAULT_LIVE_BRAIN_CONFIG: LiveBrainConfig = {
  model: "claude-sonnet-4-6",
  temperature: 0.3,
  maxTokens: 1024,
  digestRows: 50,
};

// --------------------------------------------------------------------------- //
// Anthropic client (lazy, server-only)                                        //
// --------------------------------------------------------------------------- //

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[agathon:live-brain] ANTHROPIC_API_KEY is not set. The chat surface " +
        "won't work until you add it to your Vercel environment.",
    );
  }
  _anthropic = new Anthropic({ apiKey });
  return _anthropic;
}

// --------------------------------------------------------------------------- //
// Context digest                                                              //
// --------------------------------------------------------------------------- //
//
// Design goal: at most ~30 lines, ~600 tokens. The chat Brain decides
// what to do with this; if it needs more detail it can ask the user to
// click into the finding in the dashboard. We deliberately do NOT give
// the chat Brain tool-use access — it's a read-only assistant.

interface DigestInput {
  scanId: string;
  supabase: SupabaseClient<Database>;
  /** Override default config (e.g. raise digestRows for an admin view). */
  config?: Partial<LiveBrainConfig>;
}

export async function buildContextDigest(
  input: DigestInput,
): Promise<ContextDigest> {
  const cfg = { ...DEFAULT_LIVE_BRAIN_CONFIG, ...(input.config ?? {}) };

  // Fetch scan + recent logs in parallel. RLS will gate this to the
  // requesting user (we trust whoever passed in the supabase client).
  const [scanRes, logsRes] = await Promise.all([
    input.supabase
      .from("scans")
      .select("id, status, progress_pct, target_model, target_url")
      .eq("id", input.scanId)
      .maybeSingle(),
    input.supabase
      .from("scan_logs")
      .select("id, created_at, type, severity, attack_name, payload")
      .eq("scan_id", input.scanId)
      .order("created_at", { ascending: false })
      .limit(cfg.digestRows),
  ]);

  if (scanRes.error || !scanRes.data) {
    throw new Error(
      `[agathon:live-brain] Cannot load scan ${input.scanId}: ${
        scanRes.error?.message ?? "not found"
      }`,
    );
  }
  if (logsRes.error) {
    throw new Error(
      `[agathon:live-brain] Cannot load scan_logs: ${logsRes.error.message}`,
    );
  }

  const scan = scanRes.data;
  // Reverse so we render oldest -> newest, which reads naturally.
  const logs = (logsRes.data ?? []).slice().reverse();

  const severityCounts: ContextDigest["severityCounts"] = {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  for (const row of logs) {
    const sev = (row.severity ?? "info") as keyof typeof severityCounts;
    if (sev in severityCounts) severityCounts[sev]++;
  }

  // Bucket the events so the digest doesn't repeat low-signal noise.
  const findings: ScanLogRow[] = [];
  const brainDecisions: ScanLogRow[] = [];
  const errors: ScanLogRow[] = [];
  let lastAuditMessage: string | null = null;

  for (const row of logs) {
    if (row.type === "finding") findings.push(row);
    else if (row.type === "brain_decision") brainDecisions.push(row);
    else if (row.type === "error") errors.push(row);
    else if (row.type === "audit") {
      const msg = pickPayloadField(row.payload, ["summary", "message", "kind"]);
      if (msg) lastAuditMessage = msg;
    }
  }

  // Keep the highest-severity findings + the most recent brain decisions.
  const topFindings = findings
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 8);

  const recentBrain = brainDecisions.slice(-5);
  const recentErrors = errors.slice(-3);

  // ---- Render the digest (≤ ~30 lines) ----------------------------------
  const lines: string[] = [];
  lines.push(
    `# Scan ${scan.id.slice(0, 8)} — status=${scan.status} progress=${
      scan.progress_pct ?? 0
    }%`,
  );
  lines.push(`Target: model=${scan.target_model} url=${scan.target_url}`);
  lines.push(
    `Severity tally: critical=${severityCounts.critical} high=${severityCounts.high} ` +
      `medium=${severityCounts.medium} low=${severityCounts.low} info=${severityCounts.info}`,
  );
  if (lastAuditMessage) lines.push(`Last audit: ${truncate(lastAuditMessage, 140)}`);
  lines.push("");

  if (topFindings.length) {
    lines.push("## Top findings (highest severity first)");
    for (const f of topFindings) {
      const summary = pickPayloadField(f.payload, [
        "summary",
        "evidence",
        "message",
      ]);
      const family =
        pickPayloadField(f.payload, ["family", "vulnerability_type"]) ??
        "unknown";
      lines.push(
        `- [${f.severity}] ${f.attack_name ?? family} — ${truncate(
          summary ?? "(no summary)",
          110,
        )}`,
      );
    }
    lines.push("");
  } else {
    lines.push("## Top findings: (none yet)");
    lines.push("");
  }

  if (recentBrain.length) {
    lines.push("## Recent Brain decisions");
    for (const b of recentBrain) {
      const tool = pickPayloadField(b.payload, ["tool", "kind"]) ?? "decision";
      const note = pickPayloadField(b.payload, [
        "rationale",
        "reason",
        "summary",
      ]);
      lines.push(`- ${tool}${note ? `: ${truncate(note, 120)}` : ""}`);
    }
    lines.push("");
  }

  if (recentErrors.length) {
    lines.push("## Recent errors");
    for (const e of recentErrors) {
      const msg = pickPayloadField(e.payload, ["message", "error", "kind"]);
      lines.push(`- ${truncate(msg ?? "(unspecified)", 140)}`);
    }
    lines.push("");
  }

  return {
    text: lines.join("\n"),
    rowsConsidered: logs.length,
    severityCounts,
    scan,
  };
}

// --------------------------------------------------------------------------- //
// Streaming chat turn                                                         //
// --------------------------------------------------------------------------- //

const CHAT_SYSTEM_PROMPT = `\
You are Agathon — the assistant chat persona for an autonomous AI red-team
scan. The scan is running on a separate worker; your job is to help the
operator understand and navigate what it is doing in real time.

Rules:
1. Ground every answer in the supplied scan context. If the context doesn't
   contain the answer, say so plainly — do not speculate about what the
   Brain "probably did".
2. Keep responses tight. Operators are mid-engagement; long lectures hurt.
3. When the operator asks for next-step advice, suggest concrete actions
   they can take in the dashboard (skip an attack, escalate, seal early).
4. You do NOT have tools — you cannot run attacks, modify the scan, or
   fetch external data. If asked, say so and tell the operator how they
   can do it themselves from the dashboard.
5. Never invent finding IDs, severities, or payloads not present in the
   context block. If pressed, refuse and ask them to click into the
   relevant log line.`;

interface StreamChatTurnInput {
  digest: ContextDigest;
  userMessage: string;
  history?: ChatHistoryTurn[];
  config?: Partial<LiveBrainConfig>;
  /** AbortSignal to cut the stream short if the SSE client disconnects. */
  signal?: AbortSignal;
}

export async function* streamChatTurn(
  input: StreamChatTurnInput,
): AsyncGenerator<ChatChunk, void, void> {
  const cfg = { ...DEFAULT_LIVE_BRAIN_CONFIG, ...(input.config ?? {}) };
  const anthropic = getAnthropic();

  const messages = [
    ...(input.history ?? []).map((t) => ({
      role: t.role,
      content: t.content,
    })),
    {
      role: "user" as const,
      content: input.userMessage,
    },
  ];

  // Composite system prompt — base persona + per-turn scan context.
  const system = [
    { type: "text" as const, text: CHAT_SYSTEM_PROMPT },
    {
      type: "text" as const,
      text: `<scan_context>\n${input.digest.text}\n</scan_context>`,
      // Cache the context block — it's the same across all turns in a
      // chat session, so we save tokens after turn #1.
      cache_control: { type: "ephemeral" as const },
    },
  ];

  let stream: Awaited<ReturnType<typeof anthropic.messages.stream>>;
  try {
    stream = anthropic.messages.stream({
      model: cfg.model,
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
      system,
      messages,
    });
  } catch (err) {
    yield {
      kind: "error",
      message: `failed to open stream: ${(err as Error).message}`,
    };
    return;
  }

  // Hook abort -> close stream.
  if (input.signal) {
    input.signal.addEventListener(
      "abort",
      () => {
        try {
          stream.controller.abort();
        } catch {
          /* swallow */
        }
      },
      { once: true },
    );
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: string | null = null;

  try {
    for await (const event of stream) {
      switch (event.type) {
        case "content_block_delta": {
          if (event.delta.type === "text_delta") {
            yield { kind: "text", delta: event.delta.text };
          }
          break;
        }
        case "message_delta": {
          if (event.usage?.output_tokens) {
            outputTokens = event.usage.output_tokens;
          }
          if (event.delta.stop_reason) {
            stopReason = event.delta.stop_reason;
          }
          break;
        }
        case "message_start": {
          if (event.message.usage?.input_tokens) {
            inputTokens = event.message.usage.input_tokens;
          }
          break;
        }
        default:
          break;
      }
    }
  } catch (err) {
    if (input.signal?.aborted) {
      yield { kind: "done", stop_reason: "client_disconnect" };
      return;
    }
    yield {
      kind: "error",
      message: `stream failed: ${(err as Error).message}`,
    };
    return;
  }

  yield { kind: "usage", input_tokens: inputTokens, output_tokens: outputTokens };
  yield { kind: "done", stop_reason: stopReason };
}

// --------------------------------------------------------------------------- //
// Helpers                                                                     //
// --------------------------------------------------------------------------- //

function severityRank(s: string | null): number {
  switch (s) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function pickPayloadField(
  payload: unknown,
  candidates: string[],
): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  for (const k of candidates) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
