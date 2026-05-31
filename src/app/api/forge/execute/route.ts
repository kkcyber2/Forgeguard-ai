/**
 * POST /api/forge/execute
 * -----------------------
 * Sandboxed script execution endpoint for The Forge.
 *
 * Accepts a script_id (seeded) or raw source + language.
 * Proxies to the Railway/Agathon orchestrator's /forge/execute endpoint,
 * which runs code in an isolated Docker sandbox that:
 *   - Has no network access to internal services
 *   - Blocks access to env variables (GROQ_KEY, SUPABASE keys, etc.)
 *   - Caps execution at 30 seconds / 64MB RAM
 *
 * Streams back JSONL events so the browser terminal can display output
 * line-by-line using SSE (text/event-stream).
 *
 * Auth: requires active Supabase session. Role gate: hacker or developer.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  engineAuthHeaders,
  resolveEngineAuthToken,
  resolveEngineBaseUrl,
} from "@/lib/agathon-config";
import { SEEDED_SCRIPTS } from "@/lib/forge/seeded-scripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExecuteSchema = z.union([
  z.object({
    script_id: z.enum(["homoglyph", "markdown_exfil", "escalation"]),
    custom_source: z.undefined().optional(),
  }),
  z.object({
    script_id: z.undefined().optional(),
    custom_source: z.string().min(1).max(8000),
    language: z.enum(["python"]),
  }),
]);

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // ── Generate session token for kill targeting ──────────────────────────
  const sessionId = crypto.randomUUID();

  // ── Identity gate: hacker or developer only ────────────────────────────
  type ProfileRow = { user_type: string | null; access_level: number | null };
  const { data: profile } = (await supabase
    .from("profiles")
    .select("user_type, access_level")
    .eq("id", user.id)
    .maybeSingle()) as { data: ProfileRow | null };

  if (!profile || profile.access_level === null || profile.access_level < 3) {
    return NextResponse.json(
      {
        ok: false,
        error: "The Forge requires a Hacker or Developer identity. Upgrade your access in Settings.",
        code: "IDENTITY_GATE",
      },
      { status: 403 },
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ExecuteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Bad request" },
      { status: 400 },
    );
  }

  // ── Resolve script source ─────────────────────────────────────────────
  let source: string;
  let language = "python";
  let scriptName: string;

  if ("script_id" in parsed.data && parsed.data.script_id) {
    const script = SEEDED_SCRIPTS[parsed.data.script_id];
    source = script.source;
    language = script.language;
    scriptName = script.name;
  } else if ("custom_source" in parsed.data && parsed.data.custom_source) {
    source = parsed.data.custom_source;
    language = (parsed.data as { language: string }).language ?? "python";
    scriptName = "Custom Script";
  } else {
    return NextResponse.json({ ok: false, error: "No script provided" }, { status: 400 });
  }

  // ── Traitor Protocol — custom script policy scan ──────────────────────
  // Seeded scripts are trusted; only custom_source is scanned.
  // Patterns mirror live-fire/route.ts TRAITOR_PATTERNS.
  if ("custom_source" in parsed.data && parsed.data.custom_source) {
    const TRAITOR_PATTERNS: RegExp[] = [
      /SUPABASE_URL/i,
      /SUPABASE_ANON_KEY/i,
      /SUPABASE_SERVICE_ROLE/i,
      /SUPABASE_SERVICE_KEY/i,
      /DATABASE_URL/i,
      /OPENROUTER_API_KEY/i,
      /FORGEGUARD_API_KEY/i,
      /process\.env\s*\.\s*(SUPABASE|DATABASE|OPENROUTER|FORGEGUARD)/i,
      /os\.environ.*?(SUPABASE|DATABASE|OPENROUTER|FORGEGUARD)/i,
      /\$\{?\s*(SUPABASE|DATABASE_URL|OPENROUTER_API_KEY|FORGEGUARD)/i,
    ];

    if (TRAITOR_PATTERNS.some((re) => re.test(parsed.data.custom_source as string))) {
      // Freeze wallet + Intel Hub broadcast via admin client
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } },
        );
        await adminClient.rpc("freeze_wallet", {
          p_user_id: user.id,
          p_reason:  "Traitor Protocol: credential exfiltration attempt in custom Forge script.",
        });
        const handle = (user.email?.split("@")[0] ?? user.id.slice(0, 8)).toUpperCase();
        await adminClient.from("intel_messages").insert({
          user_id: user.id,
          content: `🚨 ${handle} ATTEMPTED SYSTEM EXFILTRATION. RANK SET TO TRAITOR. ASSETS FROZEN.`,
        });
      } catch {
        // Non-fatal; respond with block regardless.
      }

      const enc = new TextEncoder();
      const blockStream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(
            `data: ${JSON.stringify({
              type:    "error",
              line:    "⛔ POLICY VIOLATION — Credential exfiltration attempt detected.",
              message: "Your account has been restricted. Contact support@forgeguard.ai.",
              code:    "TRAITOR_PROTOCOL",
            })}\n\n`,
          ));
          c.enqueue(enc.encode(`data: ${JSON.stringify({ type: "done", exit_code: 1 })}\n\n`));
          c.close();
        },
      });

      return new Response(blockStream, {
        status: 200,
        headers: {
          "Content-Type":  "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection:      "keep-alive",
        },
      });
    }
  }

  // ── Python sandbox: no Railway needed — run safe subset locally ────────
  // For custom scripts, we forward to Railway orchestrator's /forge/execute.
  // For seeded scripts, we execute them in-process via a restricted Python
  // subprocess call through the orchestrator, or simulate output here.
  //
  // This endpoint returns SSE for real-time streaming.

  const orchestratorUrl = resolveEngineBaseUrl();
  const orchestratorSecret = resolveEngineAuthToken();

  // ── Supabase Realtime broadcast channel for this session ──────────────
  // Events are sent both via SSE (to the originating browser tab) AND
  // broadcast on forge:rt:<sessionId> so the UI Realtime subscriber can
  // receive them as a redundant/resilient channel.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rtChannel: any = null;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    // Channel keyed by sessionId so concurrent sessions are isolated
    rtChannel = admin.channel(`forge:rt:${sessionId}`);
    await rtChannel.subscribe();
  } catch {
    rtChannel = null;
  }

  async function broadcastLine(data: Record<string, unknown>) {
    if (!rtChannel) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await rtChannel.send({
        type:    "broadcast",
        event:   "forge_line",
        payload: { session_id: sessionId, ...data },
      });
    } catch {
      // best-effort — never block SSE stream
    }
  }

  // Build an SSE stream
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  function send(data: object) {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
    );
    void broadcastLine(data as Record<string, unknown>);
  }

  // Fire-and-forget: run the execution and stream results
  (async () => {
    try {
      send({ type: "start", script: scriptName, language, session_id: sessionId, ts: Date.now() });

      if (orchestratorUrl && orchestratorSecret) {
        // Forward to Railway for sandboxed execution
        const resp = await fetch(`${orchestratorUrl}/forge/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...engineAuthHeaders(),
          },
          body: JSON.stringify({ source, language, user_id: user.id, session_id: sessionId }),
          signal: AbortSignal.timeout(35_000),
        });

        if (!resp.ok || !resp.body) {
          send({
            type: "error",
            message: `Orchestrator returned ${resp.status}`,
          });
          controller.close();
          return;
        }

        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = dec.decode(value).split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              send(event);
            } catch {
              send({ type: "stdout", line });
            }
          }
        }
      } else {
        // Simulate execution locally (dev / no Railway configured)
        send({
          type: "info",
          message: "⚡ ForgeGuard Sandbox — Local Execution Mode",
        });
        send({
          type: "info",
          message:
            "Set PYTHON_ENGINE_URL to route to the Railway bunker (Agathon engine).",
        });
        send({ type: "stdout", line: "" });

        // Produce the seeded script output deterministically
        const lines = source.split("\n");
        for (const line of lines) {
          if (line.startsWith("#") || line.trim() === "") {
            // Skip comments/blank in simulation, but show as dim output
            send({ type: "comment", line });
          } else if (line.startsWith("print(")) {
            // Simulate print output (rough extraction)
            const match = line.match(/print\(f?["'](.+?)["']/);
            if (match) {
              send({
                type: "stdout",
                line: match[1]
                  .replace(/\\n/g, "")
                  .replace(/\{.*?\}/g, "[dynamic]"),
              });
            }
          }
          await new Promise((r) => setTimeout(r, 12));
        }

        send({
          type: "stdout",
          line: "",
        });
        send({
          type: "done",
          exit_code: 0,
          message: "Script completed successfully.",
        });
      }
    } catch (err) {
      send({
        type: "error",
        message: `Execution error: ${(err as Error).message}`,
      });
    } finally {
      controller.close();
      // Unsubscribe from Realtime channel
      if (rtChannel) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        try { await rtChannel.unsubscribe(); } catch { /* ignore */ }
      }
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// GET /api/forge/execute → list available seeded scripts
export async function GET() {
  const scripts = Object.entries(SEEDED_SCRIPTS).map(([id, s]) => ({
    id,
    name: s.name,
    description: s.description,
    language: s.language,
  }));
  return NextResponse.json({ ok: true, scripts });
}
