import "server-only";

import Groq from "groq-sdk";
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
 * Brain runtime: Groq (OpenAI-compatible). Default model is
 * `llama-3.3-70b-versatile`, which natively supports tool calling and
 * has 128k context — comfortably more than we ever feed it via the digest.
 *
 * Public surface:
 *   - buildContextDigest({scanId, supabase}) -> ContextDigest
 *       Pure read; safe to call from any server boundary that has a
 *       Supabase client (RLS-scoped is fine — the user can only see
 *       their own scans anyway).
 *
 *   - streamChatTurn({digest, userMessage, history}) -> AsyncIterable<ChatChunk>
 *       Wraps the Groq streaming SDK. The route handler at
 *       /api/agathon/chat just iterates and pumps SSE frames.
 *
 *   - LiveBrainConfig
 *       Centralised model/tier knobs so we can hot-swap models without
 *       grepping for model strings.
 */

// --------------------------------------------------------------------------- //
// Types                                                                       //
// --------------------------------------------------------------------------- //

type ScanRow = Database["public"]["Tables"]["scans"]["Row"];
type ScanLogRow = Database["public"]["Tables"]["scan_logs"]["Row"];

export interface ContextDigest {
  /** The compressed text fed to the model as the system-context block. */
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
  /** Groq (OpenAI-compatible) model id. */
  model: string;
  /** Sampling temp for the chat persona. Lower = more factual. */
  temperature: number;
  /** Max output tokens per turn. */
  maxTokens: number;
  /** How many scan_logs rows to pull when building the digest. */
  digestRows: number;
}

export const DEFAULT_LIVE_BRAIN_CONFIG: LiveBrainConfig = {
  // Free-tier Groq model with native tool-call support and 128k context.
  // The orchestrator uses the same model — keep them in sync unless you
  // deliberately want different posture for chat vs autonomous loop.
  model: "llama-3.3-70b-versatile",
  temperature: 0.3,
  maxTokens: 1024,
  digestRows: 50,
};

// --------------------------------------------------------------------------- //
// Groq client (lazy, server-only)                                             //
// --------------------------------------------------------------------------- //

let _groq: Groq | null = null;
function getGroq(): Groq {
  if (_groq) return _groq;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[agathon:live-brain] GROQ_API_KEY is not set. The chat surface " +
        "won't work until you add it to your Vercel environment.",
    );
  }
  _groq = new Groq({ apiKey });
  return _groq;
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
  /**
   * Accept ANY SupabaseClient typed against our Database. We deliberately
   * leave the schema generics open because `@supabase/ssr.createServerClient`
   * and `@supabase/supabase-js.SupabaseClient` resolve to slightly different
   * generic arities (3 vs 4 type params depending on package version), and
   * TypeScript can't unify them across the package boundary. This widening
   * is type-only — runtime behaviour is identical, and every property we
   * touch (`.from`, `.auth`) is the same on both shapes.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database, any, any>;
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
  const groq = getGroq();

  // Groq is OpenAI-compatible: the system context block is just a second
  // system message. We keep it as a separate message (rather than
  // concatenating into one) so the persona prompt and per-scan digest stay
  // visually distinct in transcripts.
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    {
      role: "system",
      content: `<scan_context>\n${input.digest.text}\n</scan_context>`,
    },
    ...(input.history ?? []).map((t) => ({
      role: t.role,
      content: t.content,
    })),
    { role: "user", content: input.userMessage },
  ];

  let stream: Awaited<ReturnType<typeof groq.chat.completions.create>>;
  try {
    stream = await groq.chat.completions.create(
      {
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        messages,
        stream: true,
      },
      {
        // Forward the abort signal so we don't keep the upstream socket
        // open if the SSE client disconnects mid-turn.
        signal: input.signal,
      },
    );
  } catch (err) {
    yield {
      kind: "error",
      message: `failed to open stream: ${(err as Error).message}`,
    };
    return;
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: string | null = null;

  try {
    // Groq's streaming returns AsyncIterable<ChatCompletionChunk> — each
    // chunk has `choices[0].delta.content` (a string fragment) and on the
    // final chunk a `finish_reason` + `x_groq.usage` block.
    for await (const chunk of stream as AsyncIterable<{
      choices: Array<{
        delta: { content?: string | null };
        finish_reason: string | null;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
      x_groq?: {
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
    }>) {
      const choice = chunk.choices?.[0];
      const delta = choice?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        yield { kind: "text", delta };
      }
      if (choice?.finish_reason) {
        stopReason = choice.finish_reason;
      }
      // Groq exposes usage on the terminal chunk under either `usage` or
      // `x_groq.usage` depending on SDK version — read both, keep the latest.
      const usage = chunk.usage ?? chunk.x_groq?.usage;
      if (usage) {
        if (typeof usage.prompt_tokens === "number") {
          inputTokens = usage.prompt_tokens;
        }
        if (typeof usage.completion_tokens === "number") {
          outputTokens = usage.completion_tokens;
        }
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
