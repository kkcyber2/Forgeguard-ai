/**
 * POST /api/forge/kill
 * --------------------
 * Sends a SIGKILL to the running Forge process on the Railway Python engine.
 *
 * Body: { session_id: string }  — the session token returned by /forge/execute
 *
 * If AGATHON_ORCHESTRATOR_URL is not set the endpoint returns 200 immediately
 * (the client-side AbortController on the SSE reader already kills the stream).
 *
 * Auth: same gate as /forge/execute — hacker or developer.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { engineAuthHeaders, resolveEngineBaseUrl } from "@/lib/agathon-config";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KillSchema = z.object({
  session_id: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // ── Identity gate ─────────────────────────────────────────────────────────
  type ProfileRow = { access_level: number | null };
  const { data: profile } = (await supabase
    .from("profiles")
    .select("access_level")
    .eq("id", user.id)
    .maybeSingle()) as { data: ProfileRow | null };

  if (!profile || (profile.access_level ?? 0) < 3) {
    return NextResponse.json(
      { ok: false, error: "Forge access required.", code: "IDENTITY_GATE" },
      { status: 403 },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = KillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Bad request" },
      { status: 400 },
    );
  }

  const { session_id } = parsed.data;

  // ── Forward kill signal to Railway engine ─────────────────────────────────
  const orchestratorUrl = resolveEngineBaseUrl();

  if (orchestratorUrl && engineAuthHeaders()) {
    try {
      const resp = await fetch(`${orchestratorUrl}/forge/kill`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...engineAuthHeaders(),
        },
        body: JSON.stringify({ session_id, user_id: user.id }),
        signal: AbortSignal.timeout(8_000),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        return NextResponse.json(
          { ok: false, error: `Engine returned ${resp.status}: ${text.slice(0, 120)}` },
          { status: 502 },
        );
      }

      return NextResponse.json({ ok: true, killed: true, session_id });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `Kill request failed: ${(err as Error).message}` },
        { status: 502 },
      );
    }
  }

  // ── No Railway configured — client AbortController handles local kill ──────
  // Broadcast a "killed" event to the Supabase Realtime channel so the UI
  // knows to mark the terminal as terminated even in simulation mode.
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    await admin.channel(`forge:rt:${session_id}`).send({
      type:    "broadcast",
      event:   "forge_line",
      payload: {
        session_id,
        type:    "killed",
        message: "Process killed by operator.",
        ts:      Date.now(),
      },
    });
  } catch {
    // Non-fatal — channel broadcast best-effort
  }

  return NextResponse.json({ ok: true, killed: true, session_id, simulated: true });
}
