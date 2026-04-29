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
  //
  // We cast the Supabase response to a concrete row shape because
  // `.maybeSingle()` chained off a typed `.from()` sometimes collapses to
  // `never` at the Next.js TypeScript boundary (cross-package generic drift
  // between @supabase/ssr and @supabase/supabase-js). Runtime is unchanged.
  type ScanRow = { id: string; user_id: string; status: string };
  const { data: scan, error: fetchErr } = (await supabase
    .from("scans")
    .select("id, user_id, status")
    .eq("id", payload.scan_id)
    .maybeSingle()) as { data: ScanRow | null; error: { message: string } | null };
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

  // We MUST await runScan() — Vercel terminates the serverless function
  // the instant we return a response, so any unawaited Promise (including
  // the inner fetch to Railway) gets garbage-collected before its network
  // request actually goes out.
  //
  // runScan() returns quickly (~1-2s) because the heavy lifting happens
  // server-side on Railway: we just decrypt the credential, validate env,
  // transition the scan to "probing", and POST to /scan/start which
  // Railway acknowledges in <500ms before running the scan asynchronously.
  try {
    await runScan({ scanId: scan.id, userId: user.id });
  } catch (err) {
    console.error("[api/scan/start] runScan rejected:", err);
    // The runScan helper has already markFailure'd the scan row, so the
    // user sees a "failed" status with the actual reason. We just bubble
    // a 500 here so the Server Action knows something went wrong.
    return NextResponse.json(
      {
        ok: false,
        error: `Runner kickoff failed: ${(err as Error).message ?? "unknown"}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, scan_id: scan.id, message: "Runner dispatched" },
    { status: 202 },
  );
}
