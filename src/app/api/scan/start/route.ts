import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { launchScan } from "@/services/scan-launcher.service";

/**
 * POST /api/scan/start
 * --------------------
 * Kicks off a scan run for an existing `scans` row. Two-stage handshake:
 *
 *   1. Authenticate the caller via Supabase session cookies (must be the
 *      scan owner — RLS would catch a forgery anyway, but failing here
 *      gives a clean 403 instead of a silent no-op).
 *   2. Dispatch to Railway via shared scan-launcher service.
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

  const result = await launchScan({
    scanId: payload.scan_id,
    userId: user.id,
    userEmail: user.email,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        ...(result.code ? { code: result.code } : {}),
        ...(result.plan ? { plan: result.plan } : {}),
      },
      { status: result.status },
    );
  }

  if (result.alreadyRunning) {
    return NextResponse.json(
      { ok: true, message: result.message },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { ok: true, scan_id: result.scanId, message: result.message },
    { status: 202 },
  );
}
