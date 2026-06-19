/**
 * POST /api/aegis/export
 * ─────────────────────────────────────────────────────────────────────────────
 * Aegis Defense — Rule Exporter
 *
 * Reads findings from a completed scan and generates production-ready
 * defensive rule configurations in either:
 *   - Cloudflare WAF JSON  (format: "cloudflare")
 *   - Python middleware    (format: "python")
 *
 * Each finding is mapped to a concrete blocking rule based on the attack
 * technique. Rules are written to `aegis_rules` (Supabase) and returned
 * as a downloadable config payload.
 *
 * Auth: active Supabase session, scan must belong to the caller.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildCloudflareRuleset,
  aegisRulesToRows,
  techniqueKey,
  type ScanFinding,
} from "@/lib/aegis/ruleset-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Schema ──────────────────────────────────────────────────────────────────

const ExportSchema = z.object({
  scan_id: z.string().uuid(),
  format:  z.enum(["cloudflare", "python", "nextjs"]).default("cloudflare"),
});

// ─── Python middleware generator ───────────────────────────────────────────────

function buildPythonMiddleware(
  scanId:   string,
  findings: ScanFinding[],
): string {
  const seen    = new Set<string>();
  const blocks: string[] = [];

  for (const finding of findings) {
    if (finding.severity === "info") continue;
    const key = techniqueKey(finding);
    if (seen.has(key)) continue;
    seen.add(key);
  }

  const patterns: string[] = [];

  if (seen.has("homoglyph")) {
    patterns.push(
      "    # Homoglyph / Unicode confusable injection\n" +
      "    r'[\\u0430\\u0435\\u043e\\u0440\\u0441\\u0445\\u0456\\u0455]'",
    );
  }
  if (seen.has("prompt_injection")) {
    patterns.push(
      "    # Direct prompt injection\n" +
      "    r'(?i)(ignore previous instructions|ignore all prior|disregard your system)'",
    );
  }
  if (seen.has("jailbreak")) {
    patterns.push(
      "    # Jailbreak / role override\n" +
      "    r'(?i)(\\bDAN\\b|do anything now|developer mode enabled|jailbreak)'",
    );
  }
  if (seen.has("role_confusion")) {
    patterns.push(
      "    # Authority spoofing\n" +
      "    r'(?i)(maintenance mode|admin mode|system update.*access code)'",
    );
  }
  if (seen.has("markdown_exfil")) {
    patterns.push(
      "    # Markdown exfiltration probe\n" +
      "    r'!\\[[^\\]]*\\]\\(https?://[^)]+\\)'",
    );
  }
  if (seen.has("indirect_injection")) {
    patterns.push(
      "    # Indirect injection via embedded scripts\n" +
      "    r'(?i)(fetch\\(|XMLHttpRequest|navigator\\.sendBeacon)'",
    );
  }

  // Always include default
  patterns.push(
    "    # Generic system-prompt extraction\n" +
    "    r'(?i)(reveal (your|the) system prompt|print your instructions|what are your rules)'",
  );

  return `"""
ForgeGuard Aegis — Python Middleware
Generated from scan: ${scanId}
Generated at: ${new Date().toISOString()}
Rule count: ${patterns.length + 1}

USAGE (FastAPI / Starlette):
    from aegis_middleware import AegisMiddleware
    app.add_middleware(AegisMiddleware)

USAGE (Django):
    MIDDLEWARE = ['aegis_middleware.AegisDjangoMiddleware', ...]

WARNING: Review all patterns before deploying to production.
"""

import re
import json
import logging
from typing import Callable

logger = logging.getLogger("forgeguard.aegis")

# ── Compiled block patterns ──────────────────────────────────────────────────

BLOCK_PATTERNS: list[re.Pattern] = [
    re.compile(p, re.UNICODE)
    for p in [
${patterns.join(",\n")}
    ]
]

LLM_ENDPOINT_PATHS: list[str] = [
    "/api/chat",
    "/api/scan",
    "/api/forge",
    "/v1/completions",
    "/v1/chat/completions",
]

MAX_BODY_SCAN_BYTES = 32_768  # 32 KB — skip scanning huge payloads


def scan_payload(text: str) -> str | None:
    """Return the matching pattern string if blocked, else None."""
    if len(text) > MAX_BODY_SCAN_BYTES:
        return None
    for pattern in BLOCK_PATTERNS:
        m = pattern.search(text)
        if m:
            return pattern.pattern
    return None


def is_llm_path(path: str) -> bool:
    return any(path.startswith(p) for p in LLM_ENDPOINT_PATHS)


# ── FastAPI / Starlette ASGI middleware ───────────────────────────────────────

class AegisMiddleware:
    def __init__(self, app: Callable) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if not is_llm_path(path):
            await self.app(scope, receive, send)
            return

        # Buffer request body
        body_chunks: list[bytes] = []
        async def receive_wrapper():
            message = await receive()
            if message["type"] == "http.request":
                body_chunks.append(message.get("body", b""))
            return message

        await self.app(scope, receive_wrapper, send)

        body = b"".join(body_chunks).decode("utf-8", errors="replace")
        matched = scan_payload(body)
        if matched:
            logger.warning(
                "Aegis block: path=%s pattern=%s ip=%s",
                path,
                matched[:80],
                dict(scope.get("headers", {})).get(b"x-forwarded-for", b"unknown").decode(),
            )
            # Re-invoke send with 403 response
            await send({
                "type": "http.response.start",
                "status": 403,
                "headers": [(b"content-type", b"application/json")],
            })
            await send({
                "type": "http.response.body",
                "body": json.dumps({
                    "error": "Request blocked by ForgeGuard Aegis.",
                    "code":  "AEGIS_BLOCK",
                }).encode(),
            })
`;
}

// ─── Next.js Middleware generator ────────────────────────────────────────────

function buildNextjsMiddleware(
  scanId:   string,
  findings: ScanFinding[],
): string {
  const seen = new Set<string>();
  for (const f of findings) {
    if (f.severity !== "info") seen.add(techniqueKey(f));
  }

  // Build regex literal array entries
  const regexEntries: string[] = [];

  if (seen.has("homoglyph")) {
    regexEntries.push(
      "  // Homoglyph / Unicode confusable injection\n" +
      "  /[\\u0430\\u0435\\u043e\\u0440\\u0441\\u0445\\u0456\\u0455]/u",
    );
  }
  if (seen.has("prompt_injection")) {
    regexEntries.push(
      "  // Direct prompt injection\n" +
      "  /ignore previous instructions|ignore all prior|disregard your system/i",
    );
  }
  if (seen.has("jailbreak")) {
    regexEntries.push(
      "  // Jailbreak / role override\n" +
      "  /\\bDAN\\b|do anything now|developer mode enabled|jailbreak/i",
    );
  }
  if (seen.has("role_confusion")) {
    regexEntries.push(
      "  // Authority spoofing\n" +
      "  /maintenance mode|admin mode|system update.*access code/i",
    );
  }
  if (seen.has("markdown_exfil")) {
    regexEntries.push(
      "  // Markdown image exfiltration probe\n" +
      "  /!\\[[^\\]]*\\]\\(https?:\\/\\/[^)]+\\)/i",
    );
  }
  if (seen.has("indirect_injection")) {
    regexEntries.push(
      "  // Indirect injection via embedded scripts\n" +
      "  /fetch\\(|XMLHttpRequest|navigator\\.sendBeacon/i",
    );
  }

  // Always include the generic catch-all
  regexEntries.push(
    "  // Generic system-prompt extraction\n" +
    "  /reveal (your|the) system prompt|print your instructions|what are your rules/i",
  );

  const matcherPaths = [
    "/api/chat/:path*",
    "/api/scan/:path*",
    "/api/forge/:path*",
    "/api/completions/:path*",
  ];

  return `/**
 * ForgeGuard Aegis — Next.js Edge Middleware
 * Generated from scan: ${scanId}
 * Generated at: ${new Date().toISOString()}
 *
 * USAGE:
 *   1. Save this file as \`middleware.ts\` at your Next.js project root.
 *   2. Deploy — the Edge runtime runs this on every matching request
 *      before it reaches your route handlers.
 *
 * NOTE: The Edge runtime does not support Node.js APIs. Body reading
 *   consumes the stream, so this middleware clones it before forwarding.
 *   Body scanning is limited to the first 32 KB for performance.
 *
 * WARNING: Review all patterns before deploying to production.
 *   False positives are possible — tune the regexes to your use-case.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Blocked patterns (auto-generated by ForgeGuard Aegis) ────────────────────

const BLOCK_PATTERNS: RegExp[] = [
${regexEntries.join(",\n")},
];

// ── LLM API paths to protect ──────────────────────────────────────────────────

const LLM_PATHS: string[] = [
  "/api/chat",
  "/api/scan",
  "/api/forge",
  "/api/completions",
  "/v1/chat/completions",
];

const MAX_BODY_BYTES = 32_768; // 32 KB

// ── Helpers ───────────────────────────────────────────────────────────────────

function isProtectedPath(pathname: string): boolean {
  return LLM_PATHS.some((p) => pathname.startsWith(p));
}

function scanText(text: string): RegExp | null {
  const slice = text.length > MAX_BODY_BYTES ? text.slice(0, MAX_BODY_BYTES) : text;
  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(slice)) return pattern;
  }
  return null;
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // Only scan methods that carry a body
  if (req.method === "GET" || req.method === "HEAD") {
    return NextResponse.next();
  }

  let body = "";
  try {
    // Clone so the original request body is still readable downstream
    body = await req.clone().text();
  } catch {
    // Cannot read body (streaming / already consumed) — allow through
    return NextResponse.next();
  }

  const matched = scanText(body);
  if (matched) {
    console.warn(\`[Aegis] Blocked \${req.method} \${pathname} — pattern: \${matched.source.slice(0, 80)}\`);
    return new NextResponse(
      JSON.stringify({
        error: "Request blocked by ForgeGuard Aegis.",
        code:  "AEGIS_BLOCK",
      }),
      {
        status:  403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return NextResponse.next();
}

// ── Matcher config ────────────────────────────────────────────────────────────

export const config = {
  matcher: [
${matcherPaths.map((p) => `    "${p}"`).join(",\n")},
  ],
};
`;
}

// ─── Persist rules to Supabase ─────────────────────────────────────────────────

async function persistRules(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createServerSupabase>>,
  scanId: string,
  ruleset: ReturnType<typeof buildCloudflareRuleset>,
): Promise<void> {
  const rows = aegisRulesToRows(scanId, ruleset);
  await supabase.from("aegis_rules").upsert(rows, { onConflict: "rule_id" });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = ExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Bad request" },
      { status: 400 },
    );
  }

  const { scan_id, format } = parsed.data;

  // ── Verify ownership ──────────────────────────────────────────────────────
  const { data: scan } = await supabase
    .from("scans")
    .select("id, user_id, status, target_model")
    .eq("id", scan_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!scan) {
    return NextResponse.json({ ok: false, error: "Scan not found." }, { status: 404 });
  }

  // ── Pull findings ─────────────────────────────────────────────────────────
  const { data: findings } = await supabase
    .from("scan_logs")
    .select("id, type, severity, attack_name, payload, created_at")
    .eq("scan_id", scan_id)
    .in("type", ["finding", "attempt"])
    .order("created_at", { ascending: true })
    .limit(100) as { data: ScanFinding[] | null };

  const effectiveFindings: ScanFinding[] = findings ?? [
    // Seed a default set if no findings yet (incomplete scan)
    { id: 0, type: "finding", severity: "medium", attack_name: "prompt_injection", payload: null, created_at: new Date().toISOString() },
  ];

  // ── Generate output ───────────────────────────────────────────────────────
  if (format === "cloudflare") {
    const ruleset = buildCloudflareRuleset(scan_id, effectiveFindings);

    // Persist rules to Supabase for cross-reference in Bounty Vault triage
    try {
      await persistRules(supabase, scan_id, ruleset);
    } catch (e) {
      console.error("[aegis/export] persist error:", e);
    }

    return NextResponse.json({ ok: true, format: "cloudflare", ruleset });
  }

  if (format === "python") {
    const code = buildPythonMiddleware(scan_id, effectiveFindings);
    return NextResponse.json({ ok: true, format: "python", code });
  }

  // Next.js TypeScript middleware
  const code = buildNextjsMiddleware(scan_id, effectiveFindings);
  return NextResponse.json({ ok: true, format: "nextjs", code });
}
