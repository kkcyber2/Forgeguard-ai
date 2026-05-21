/**
 * POST /api/verify/ai-audit
 * Identity document triage via DeepSeek-R1 (OpenRouter).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { runIdentityAudit } from "@/lib/verify/ai-audit";

export const runtime = "nodejs";

const BodySchema = z.object({
  document_text: z.string().min(20).max(50000),
  document_path: z.string().optional(),
});

const PASS_THRESHOLD = 80;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
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
      { ok: false, error: parsed.error.issues[0]?.message ?? "Bad request" },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, identity_document_path")
    .eq("id", user.id)
    .single();

  if (!profile?.full_name) {
    return NextResponse.json(
      { ok: false, error: "Set your full name in Profile before auditing." },
      { status: 400 },
    );
  }

  const result = await runIdentityAudit({
    documentText: parsed.data.document_text,
    profileFullName: profile.full_name,
    profileEmail: profile.email,
  });

  const passed = result.name_match && result.confidence_score >= PASS_THRESHOLD;
  const status = passed ? "passed" : result.confidence_score >= 60 ? "review" : "failed";

  const admin = createAdminSupabase();
  await admin
    .from("profiles")
    .update({
      identity_audit_score: result.confidence_score,
      identity_audit_status: status,
      identity_audit_notes: result.audit_notes,
      sovereign_pending: status === "review" || status === "passed",
      identity_document_path:
        parsed.data.document_path ?? profile.identity_document_path,
      ...(passed
        ? {
            identity_verified: true,
            clearance_tier: "sovereign",
            sovereign_pending: false,
            access_level: 5,
          }
        : {}),
    })
    .eq("id", user.id);

  return NextResponse.json({
    ok: true,
    result,
    status,
    passed,
    sovereign_pending: status === "review" && !passed,
  });
}
