/**
 * POST /api/forge/live-fire
 * ─────────────────────────────────────────────────────────────────────────────
 * Live Fire Terminal — Sprint 12 Aegis Firewall edition
 *
 * Three AI tools:
 *   sqlmap-ai         → SQL injection probe simulation via Scout tier
 *   nmap-swarm        → Port-scan + banner-grab simulation via Scout
 *   dns-poison-tester → DNS takeover / cache poisoning analysis via Assassin
 *
 * Safety checks (in order):
 *   1. Auth + access_level gate
 *   2. Traitor Protocol — code_content policy scan (platform abuse detection)
 *   3. Target verification handshake (target_verifications table)
 *
 * All tools stream as SSE (text/event-stream).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { openRouterRequestHeaders } from "@/lib/agathon-config";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeHackerRankLabel } from "@/lib/access/ranks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Schema ───────────────────────────────────────────────────────────────────

const LiveFireSchema = z.object({
  tool:         z.enum(["sqlmap-ai", "nmap-swarm", "dns-poison-tester"]),
  target:       z.string().min(3).max(253),
  options:      z.record(z.string()).default({}),
  scan_id:      z.string().uuid().optional(),
  // Optional code submitted alongside the tool run — scanned for policy
  // violations before anything else happens. Not executed server-side.
  code_content: z.string().max(50_000).optional(),
});

// ─── Traitor Pattern detection ────────────────────────────────────────────────
// These regexes identify code that attempts to access platform credentials or
// internal environment variables. A match triggers the abuse-detection gate.

const TRAITOR_PATTERNS: RegExp[] = [
  /SUPABASE_URL/i,
  /SUPABASE_ANON_KEY/i,
  /SUPABASE_SERVICE_ROLE/i,
  /SUPABASE_SERVICE_KEY/i,
  /DATABASE_URL/i,
  /OPENROUTER_API_KEY/i,
  /FORGEGUARD_API_KEY/i,
  // process.env access targeting known platform vars
  /process\.env\s*\.\s*(SUPABASE|DATABASE|OPENROUTER|FORGEGUARD)/i,
  // os.environ targeting known platform vars
  /os\.environ.*?(SUPABASE|DATABASE|OPENROUTER|FORGEGUARD)/i,
  // Direct credential string exfiltration patterns
  /\$\{?\s*(SUPABASE|DATABASE_URL|OPENROUTER_API_KEY|FORGEGUARD)/i,
];

function containsTraitorPattern(code: string): boolean {
  return TRAITOR_PATTERNS.some((re) => re.test(code));
}

// ─── AI Tool prompts ──────────────────────────────────────────────────────────

function buildToolPrompt(
  tool: string,
  target: string,
  options: Record<string, string>,
): { model: "scout" | "assassin"; system: string; prompt: string } {
  switch (tool) {
    case "sqlmap-ai":
      return {
        model:  "scout",
        system: `You are sqlmap-ai, an AI-driven SQL injection testing assistant running in a ForgeGuard authorized security assessment.
Analyse the target and generate a realistic sequence of SQL injection probe events.
Output ONLY a JSON array of SSE-style event objects, one per line, like:
{"type":"probe","line":"Testing parameter: id=1'--"}
{"type":"finding","line":"[WARNING] GET parameter 'id' appears to be injectable"}
{"type":"done","line":"sqlmap-ai scan complete. 3 injection points found."}
Be technically accurate. Max 15 events.`,
        prompt: `Target: ${target}
Options: ${JSON.stringify(options)}
Generate a realistic sqlmap-style scan output for an authorized penetration test.`,
      };

    case "nmap-swarm":
      return {
        model:  "scout",
        system: `You are nmap-swarm, an AI-augmented port scanner in a ForgeGuard authorized security assessment.
Generate a realistic nmap SYN scan + banner grab output as SSE events:
{"type":"info","line":"Starting Nmap 7.94 scan on ${target}"}
{"type":"stdout","line":"80/tcp  open  http     nginx 1.18.0"}
{"type":"done","line":"Nmap done: 1 IP address scanned in 4.20 seconds"}
Include OS detection, service versions, and vulnerability hints. Max 20 events.`,
        prompt: `Target: ${target}
Scan options: ${JSON.stringify({ ...options, flags: "-sV -O -sC --top-ports 1000" })}
Generate a realistic nmap output for an authorized security scan.`,
      };

    case "dns-poison-tester":
      return {
        model:  "assassin",
        system: `You are dns-poison-tester, an AI security tool analyzing DNS infrastructure for cache poisoning vulnerabilities and takeover opportunities in a ForgeGuard authorized assessment.
Analyse the DNS configuration of the target and output findings as SSE events:
{"type":"info","line":"Querying NS records for ${target}..."}
{"type":"finding","line":"[HIGH] Subdomain takeover possible: dev.${target} → unclaimed S3 bucket"}
{"type":"done","line":"DNS analysis complete."}
Include: NS records, SOA analysis, subdomain enumeration, dangling CNAME detection. Max 20 events.`,
        prompt: `Target domain: ${target}
Options: ${JSON.stringify(options)}
Generate a DNS security analysis for an authorized penetration test.`,
      };

    default:
      return { model: "scout", system: "", prompt: target };
  }
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── OpenRouter call ──────────────────────────────────────────────────────────

async function callOpenRouter(
  model: "scout" | "assassin",
  system: string,
  prompt: string,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const modelMap = {
    scout:    "google/gemini-flash-1.5",
    assassin: "deepseek/deepseek-chat",
  };

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterRequestHeaders({
      apiKey,
      title: "ForgeGuard Live Fire",
    }),
    body: JSON.stringify({
      model:       modelMap[model],
      messages:    [
        { role: "system", content: system },
        { role: "user",   content: prompt },
      ],
      temperature: 0.5,
      max_tokens:  1024,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}: ${await resp.text()}`);
  const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // ── Access gate ─────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level, hacker_rank")
    .eq("id", user.id)
    .maybeSingle();

  if (((profile?.access_level as number | undefined) ?? 1) < 3) {
    return NextResponse.json(
      { ok: false, error: "Hacker rank required.", code: "IDENTITY_GATE" },
      { status: 403 },
    );
  }

  // Accounts already flagged as TRAITOR are blocked from all Live Fire tools
  if (normalizeHackerRankLabel(profile?.hacker_rank) === "TRAITOR") {
    return NextResponse.json(
      { ok: false, error: "Account restricted. Contact support.", code: "ACCOUNT_RESTRICTED" },
      { status: 403 },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = LiveFireSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Bad request" },
      { status: 400 },
    );
  }

  const { tool, target, options, code_content } = parsed.data;

  // ─────────────────────────────────────────────────────────────────────────────
  // TRAITOR PROTOCOL — platform abuse detection
  // Scans code_content for attempts to access ForgeGuard's own credentials.
  // On match: account is frozen and restricted. No code is executed.
  // ─────────────────────────────────────────────────────────────────────────────

  if (code_content && containsTraitorPattern(code_content)) {
    // Freeze wallet and update rank via SECURITY DEFINER RPC
    await supabase.rpc("freeze_wallet", {
      p_user_id: user.id,
      p_reason:  "Traitor Protocol: attempt to access platform credentials detected in submitted code.",
    });

    // ── Intel Hub broadcast ────────────────────────────────────────────────────
    // Shame message broadcast to all platform members via Realtime.
    // Uses service-role client to bypass RLS and insert on behalf of the
    // offending user so their handle appears in the message feed.
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      );
      const handle = (user.email?.split("@")[0] ?? user.id.slice(0, 8)).toUpperCase();
      await adminClient.from("intel_messages").insert({
        user_id: user.id,
        content: `🚨 ${handle} ATTEMPTED SYSTEM EXFILTRATION. RANK SET TO TRAITOR. ASSETS FROZEN.`,
      });
    } catch {
      // Non-fatal — wallet freeze already applied; broadcast is cosmetic.
    }

    // Return SSE error stream so terminal renders it correctly
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode(sseEvent({
          type:    "error",
          line:    "⛔ POLICY VIOLATION — Credential exfiltration attempt detected.",
          message: "Your account has been restricted. If you believe this is an error, contact support@forgeguard.ai.",
          code:    "TRAITOR_PROTOCOL",
        })));
        controller.enqueue(enc.encode(sseEvent({ type: "done", exit_code: 1 })));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TARGET VERIFICATION HANDSHAKE
  // The target domain must have a verified token before ANY live fire tool runs.
  // NO VERIFICATION = NO ATTACK.
  // ─────────────────────────────────────────────────────────────────────────────

  const rawDomain = target
    .replace(/^https?:\/\//, "")
    .split("/")[0]!
    .split(":")[0]!;

  const { data: verification } = await supabase
    .from("target_verifications")
    .select("id, verified, verified_at, expires_at")
    .eq("user_id",       user.id)
    .eq("target_domain", rawDomain)
    .eq("verified",      true)
    .gt("expires_at",    new Date().toISOString())
    .maybeSingle();

  if (!verification) {
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode(sseEvent({
          type:    "error",
          line:    `⛔ TARGET NOT VERIFIED — ${rawDomain}`,
          message: "Verification token not found or expired. Go to Bounties → Domain Verification to authorise this target before running Live Fire tools.",
          code:    "TARGET_NOT_VERIFIED",
        })));
        controller.enqueue(enc.encode(sseEvent({ type: "done", exit_code: 1 })));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
      },
    });
  }

  // ─── Build and execute tool ───────────────────────────────────────────────

  const { model, system, prompt } = buildToolPrompt(tool, target, options);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      const send = (evt: Record<string, unknown>) =>
        controller.enqueue(enc.encode(sseEvent(evt)));

      send({ type: "start", line: `[ForgeGuard Live Fire] ${tool} → ${target}` });
      send({ type: "info",  line: `▶ Verification: ${rawDomain} ✓ (verified ${new Date(verification.verified_at as string).toLocaleDateString()})` });
      send({ type: "info",  line: `▶ Model: ${model === "scout" ? "Gemini Flash 1.5 [SCOUT]" : "DeepSeek-V3 [ASSASSIN]"}` });
      send({ type: "info",  line: `▶ Target: ${target}` });
      send({ type: "info",  line: "─".repeat(60) });

      try {
        const raw = await callOpenRouter(model, system, prompt);

        const lines = raw.split("\n").filter((l) => l.trim().startsWith("{"));

        if (lines.length === 0) {
          for (const line of raw.split("\n").filter(Boolean)) {
            send({ type: "stdout", line });
          }
        } else {
          for (const line of lines) {
            try {
              const evt = JSON.parse(line) as Record<string, unknown>;
              send(evt);
              await new Promise((r) => setTimeout(r, 60));
            } catch {
              send({ type: "stdout", line });
            }
          }
        }

        send({ type: "done", exit_code: 0, tool, target });
      } catch (err) {
        send({
          type:      "error",
          line:      `✗ ${tool} execution error: ${err instanceof Error ? err.message : String(err)}`,
          exit_code: 1,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
