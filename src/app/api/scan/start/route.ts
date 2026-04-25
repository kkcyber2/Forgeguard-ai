import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { runScan } from "@/lib/runner/runner";

/**
 * POST /api/scan/start
 * --------------------
 * Kicks off a scan run for an existing `scans` row. Two-stage handshake:
 *
 *   1. Authenticate the caller via Supabase session cookies (must be the
 *      scan owner — RLS would catch a forgery anyway, but failing here
 *      gives a clean 403 instead of a silent no-op).
 *   2. Spawn the Python red-team toolkit asynchronously. Streaming
 *      writes to `scan_logs` happen inside `runScan()` via the
 *      service-role client; this handler returns immediately so the
 *      Server Action that called it isn't blocked on probe latency.
 *
 * Force the Node runtime — child_process and the Supabase admin client
 * both require it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const StartSchema = z.object({
  scan_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  let payload: { scan_id: string };
  try {
    const body = await req.json();
    const parsed = StartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid scan_id" },
        { status: 400 },
      );
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed JSON body" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // Confirm the scan exists and belongs to this user. RLS would block
  // foreign rows from being returned anyway, but this check turns a
  // silent "no rows" into an explicit 403/404.
  const { data: scan, error: fetchErr } = await supabase
    .from("scans")
    .select("id, user_id, status")
    .eq("id", payload.scan_id)
    .maybeSingle();
  if (fetchErr) {
    console.error("[api/scan/start] fetch:", fetchErr.message);
    return NextResponse.json(
      { ok: false, error: "Lookup failed" },
      { status: 500 },
    );
  }
  if (!scan) {
    return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });
  }
  if (scan.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (scan.status === "probing" || scan.status === "triage") {
    return NextResponse.json(
      { ok: true, message: "Scan already running" },
      { status: 200 },
    );
  }

  // Fire-and-forget. The runner appends to scan_logs via the
  // service-role client and updates `scans.status` / `progress_pct`
  // as it goes; the dashboard's Realtime channel picks it up.
  void runScan({ scanId: scan.id, userId: user.id }).catch((err) => {
    console.error("[api/scan/start] runScan rejected:", err);
  });

  return NextResponse.json(
    { ok: true, scan_id: scan.id, message: "Runner dispatched" },
    { status: 202 },
  );
}
