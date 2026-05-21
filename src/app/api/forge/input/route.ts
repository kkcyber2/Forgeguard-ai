/**
 * POST /api/forge/input
 * ─────────────────────────────────────────────────────────────────────────────
 * Saves a user's stdin content to the terminal_inputs table so the Railway
 * worker can poll it when a script pauses waiting for input.
 *
 * The worker queries: SELECT * FROM terminal_inputs
 *   WHERE session_id = $1 AND consumed = false ORDER BY created_at LIMIT 1
 * then marks consumed = true after reading.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";

const BodySchema = z.object({
  session_id: z.string().min(1).max(128),
  content:    z.string().min(1).max(4096),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { session_id, content } = parsed.data;
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("terminal_inputs")
    .insert({ user_id: user.id, session_id, content, consumed: false })
    .select()
    .single();

  if (error) {
    console.error("[forge/input]", error.message);
    return NextResponse.json({ error: "DB write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, input: data }, { status: 201 });
}
