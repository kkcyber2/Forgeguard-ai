import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import {
  engineAuthHeaders,
  resolveEngineAuthToken,
  resolveEngineBaseUrl,
} from "@/lib/agathon-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  code: z.string().min(10).max(50_000),
  networkAllowed: z.boolean().optional().default(true),
  targetUrl: z.string().url().optional().default("https://example.com"),
});

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

async function requireDeveloperAccess(userId: string, email: string | undefined) {
  const supabase = await createServerSupabase();
  if (isSovereignOperator(email)) return { ok: true as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("id", userId)
    .maybeSingle();
  const accessLevel = (profile?.access_level as number | undefined) ?? 1;
  if (accessLevel >= 5) return { ok: true as const };
  if (accessLevel < 3) {
    return { ok: false as const, error: "Rank 3+ required to test attack tools.", status: 403 };
  }
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  const gate = await requireDeveloperAccess(user.id, user.email);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded — max 5 sandbox tests per minute." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const engineUrl = resolveEngineBaseUrl();
  const engineToken = resolveEngineAuthToken();
  if (!engineUrl || !engineToken) {
    return NextResponse.json(
      { ok: false, error: "Engine not configured on this deployment." },
      { status: 503 },
    );
  }

  const auth = engineAuthHeaders();
  const target = `${engineUrl.replace(/\/+$/, "")}/developer/test-probe`;

  try {
    const resp = await fetch(target, {
      method: "POST",
      headers: { ...auth!, "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        code: parsed.data.code,
        network: parsed.data.networkAllowed,
        target_url: parsed.data.targetUrl,
      }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });

    const payload = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: String(payload.error ?? payload.detail ?? "Engine sandbox test failed"),
          exit_code: payload.exit_code ?? -1,
        },
        { status: resp.status >= 500 ? 502 : resp.status },
      );
    }

    return NextResponse.json({
      ok: Boolean(payload.ok),
      exit_code: payload.exit_code ?? -1,
      stdout: String(payload.stdout ?? ""),
      stderr_tail: String(payload.stderr_tail ?? ""),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Engine request failed",
      },
      { status: 502 },
    );
  }
}
