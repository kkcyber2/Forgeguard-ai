import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { exportAegisRule } from "@/services/aegis-rule-export.service";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExportSchema = z.object({
  scanId: z.string().uuid(),
  findingId: z.string().max(64).optional(),
  appId: z.string().min(1).max(128).optional(),
  description: z.string().max(500).optional(),
  attackString: z.string().max(4000).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 },
    );
  }

  const result = await exportAegisRule({
    scanId: parsed.data.scanId,
    userId: user.id,
    findingId: parsed.data.findingId,
    appId: parsed.data.appId,
    description: parsed.data.description,
    attackString: parsed.data.attackString,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    ruleId: result.ruleId,
    appId: result.appId,
    download: result.download,
  });
}
