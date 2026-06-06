import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VerifySchema = z.object({
  prompt: z.string().min(1).max(16_000),
  appId: z.string().min(1).max(128),
});

type AegisRuleRow = {
  rule_content: string | null;
  pattern: string;
  enabled: boolean;
};

function ruleContentInPrompt(prompt: string, ruleContent: string): boolean {
  const needle = ruleContent.trim();
  if (!needle || needle.length < 4) return false;
  return prompt.toLowerCase().includes(needle.toLowerCase());
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ allowed: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { allowed: false, error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 },
    );
  }

  const { prompt, appId } = parsed.data;
  const admin = createAdminSupabase();

  const { data: rules, error } = await admin
    .from("aegis_rules")
    .select("rule_content, pattern, enabled")
    .eq("app_id", appId)
    .eq("enabled", true)
    .limit(128);

  if (error) {
    console.error("[aegis:verify] query:", error.message);
    return NextResponse.json(
      { allowed: true, degraded: true, ms: Date.now() - t0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const rows = (rules ?? []) as AegisRuleRow[];

  for (const rule of rows) {
    const content = rule.rule_content?.trim() || rule.pattern?.trim() || "";
    if (content && ruleContentInPrompt(prompt, content)) {
      return NextResponse.json(
        {
          allowed: false,
          reason: "BLOCKED_BY_FORGEGUARD",
          ms: Date.now() - t0,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.json(
    { allowed: true, ms: Date.now() - t0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "aegis-verify", runtime: "nodejs" });
}
