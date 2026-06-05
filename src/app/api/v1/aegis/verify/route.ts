import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime = "edge";

const VerifySchema = z.object({
  prompt: z.string().min(1).max(16_000),
  appId: z.string().min(1).max(128),
  userId: z.string().uuid().optional(),
});

type ShieldRule = {
  pattern: string;
  action: string;
  enabled: boolean;
};

function matchesPattern(prompt: string, pattern: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  try {
    return new RegExp(p, "i").test(prompt);
  } catch {
    return prompt.toLowerCase().includes(p.toLowerCase());
  }
}

function getEdgeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

  const { prompt, appId, userId } = parsed.data;
  const supabase = getEdgeSupabase();
  if (!supabase) {
    return NextResponse.json({ allowed: true, degraded: true });
  }

  let rulesQuery = supabase
    .from("aegis_shield_rules")
    .select("pattern, action, enabled, user_id")
    .eq("app_id", appId)
    .eq("enabled", true)
    .limit(64);

  if (userId) {
    rulesQuery = rulesQuery.eq("user_id", userId);
  }

  const { data: rules, error } = await rulesQuery;

  if (error) {
    // Table may not exist yet — fail open for availability
    return NextResponse.json(
      { allowed: true, degraded: true, ms: Date.now() - t0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const rows = (rules ?? []) as ShieldRule[];
  let blocked = false;
  let explicitlyAllowed = false;

  for (const rule of rows) {
    if (!matchesPattern(prompt, rule.pattern)) continue;
    if (rule.action === "block") blocked = true;
    if (rule.action === "allow") explicitlyAllowed = true;
  }

  const allowed = explicitlyAllowed || !blocked;

  return NextResponse.json(
    { allowed, ms: Date.now() - t0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "aegis-verify", runtime: "edge" });
}
