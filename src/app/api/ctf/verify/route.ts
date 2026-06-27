import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { CtfVerifyResponse } from "@/lib/ctf/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ctf/verify
 * Body: { challengeId: uuid, flag: string }
 *
 * Delegates to the SECURITY DEFINER RPC submit_ctf_flag which atomically
 * hashes the submitted flag, records the submission, awards points +
 * reputation on success, and prevents double-solves. The flag_hash is
 * never exposed to the client.
 */
const VerifySchema = z.object({
  challengeId: z.string().uuid(),
  flag: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorised" } satisfies CtfVerifyResponse,
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" } satisfies CtfVerifyResponse,
      { status: 400 },
    );
  }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "challengeId and flag are required" } satisfies CtfVerifyResponse,
      { status: 400 },
    );
  }

  const admin = createAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc("submit_ctf_flag", {
    p_challenge_id: parsed.data.challengeId,
    p_user_id: user.id,
    p_flag: parsed.data.flag,
  });

  if (error) {
    console.error("[ctf] submit_ctf_flag:", error.message);
    return NextResponse.json(
      { ok: false, error: "Verification failed" } satisfies CtfVerifyResponse,
      { status: 500 },
    );
  }

  const result = data as CtfVerifyResponse;
  if (!result?.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
