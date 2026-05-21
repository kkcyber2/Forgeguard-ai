/**
 * PUT /api/admin/bazaar/verify
 * Admin-only: set audit_verdict on a bazaar script.
 * Body: { script_id: string; verdict: "cleared" | "rejected" }
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  script_id: z.string().uuid(),
  verdict: z.enum(["cleared", "rejected"]),
});

export async function PUT(req: NextRequest) {
  const admin_profile = await requireAdminProfile();
  if (!admin_profile) {
    return NextResponse.json(
      { ok: false, error: "Admin access required" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("bazaar_scripts")
    .update({
      audit_verdict: parsed.data.verdict,
      is_published: parsed.data.verdict === "cleared",
    })
    .eq("id", parsed.data.script_id)
    .select("id, name, audit_verdict, is_published")
    .single();

  if (error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, script: data });
}
