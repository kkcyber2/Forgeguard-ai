/**
 * GET /api/admin/bazaar/script?id=<uuid>
 * Admin-only: fetch a single bazaar script by ID (including code column).
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminProfile } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin_profile = await requireAdminProfile();
  if (!admin_profile) {
    return NextResponse.json(
      { ok: false, error: "Admin access required" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing script id" },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("bazaar_scripts")
    .select(
      "id, name, description, language, tags, price_credits, risk_score, audit_verdict, is_published, created_at, code, author_id",
    )
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.code === "PGRST116" ? 404 : 500 },
    );
  }

  return NextResponse.json({ ok: true, script: data });
}
