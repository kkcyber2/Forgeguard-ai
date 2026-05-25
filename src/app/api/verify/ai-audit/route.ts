/**
 * POST /api/verify/ai-audit
 * Identity document triage — loads from verification-docs, vision + DeepSeek-R1.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { executeIdentityAuditForUser } from "@/lib/verify/identity-audit-pipeline";

export const runtime = "nodejs";

const BodySchema = z
  .object({
    document_path: z.string().min(3).max(512),
    document_text: z.string().max(50000).optional(),
  })
  .refine(
    (d) => d.document_path.length > 0,
    { message: "document_path is required" },
  );

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

  const documentPath =
    parsed.data.document_path ?? profile.identity_document_path ?? "";
  if (!documentPath) {
    return NextResponse.json(
      { ok: false, error: "Upload identity documentation first." },
      { status: 400 },
    );
  }

  const outcome = await executeIdentityAuditForUser(
    user.id,
    documentPath,
    profile,
    parsed.data.document_text,
  );

  if (outcome.error) {
    return NextResponse.json(
      {
        ok: false,
        error: outcome.error,
        failure_reason: outcome.failure_reason,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    result: outcome.result,
    status: outcome.status,
    passed: outcome.passed,
    failure_reason: outcome.failure_reason,
    sovereign_pending: outcome.status === "review" && !outcome.passed,
  });
}
