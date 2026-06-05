import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { defaultAegisAppId, snippetToShieldPattern } from "@/lib/aegis/shield-rules";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExportSchema = z.object({
  pattern: z.string().min(1).max(500),
  description: z.string().max(500).optional(),
  appId: z.string().min(1).max(128).optional(),
  scanId: z.string().uuid().optional(),
  findingId: z.string().max(64).optional(),
});

type ShieldRuleRow = {
  app_id: string;
  user_id: string;
  pattern: string;
  description: string;
  action: "block";
  enabled: boolean;
};

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

  const { pattern, description, appId, scanId, findingId } = parsed.data;
  const shieldPattern = snippetToShieldPattern(pattern);
  if (!shieldPattern) {
    return NextResponse.json({ ok: false, error: "Empty remediation pattern" }, { status: 400 });
  }

  const resolvedAppId = appId ?? defaultAegisAppId(user.id);
  const desc =
    description?.trim() ||
    (findingId && scanId
      ? `Scan ${scanId.slice(0, 8)} · finding ${findingId}`
      : "Exported from ForgeGuard scan");

  try {
    const admin = createAdminSupabase() as SupabaseClient;
    const row: ShieldRuleRow = {
      app_id: resolvedAppId,
      user_id: user.id,
      pattern: shieldPattern,
      description: desc.slice(0, 500),
      action: "block",
      enabled: true,
    };

    const { data, error } = await admin
      .from("aegis_shield_rules")
      .insert(row)
      .select("id, app_id")
      .single();

    if (error) {
      console.error("[aegis:rules] insert:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: (data as { id?: string })?.id,
      appId: resolvedAppId,
    });
  } catch (e) {
    console.error("[aegis:rules] admin:", e);
    return NextResponse.json({ ok: false, error: "Could not persist shield rule" }, { status: 500 });
  }
}
