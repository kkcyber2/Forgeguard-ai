import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  fetchActiveAegisRules,
  promptMatchesRules,
} from "@/lib/aegis/verify-rules";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const VerifySchema = z.object({
  prompt: z.string().min(1).max(16_000),
  appId: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { allowed: false, error: "Invalid JSON" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        allowed: false,
        error: parsed.error.issues[0]?.message ?? "Validation error",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { prompt, appId } = parsed.data;

  try {
    const rules = await fetchActiveAegisRules(appId);
    const blocked = promptMatchesRules(prompt, rules);
    const ms = Date.now() - t0;

    if (blocked) {
      return NextResponse.json(
        { allowed: false, reason: "BLOCKED_BY_FORGEGUARD", ms },
        { headers: { "Cache-Control": "no-store", "X-Aegis-Latency-Ms": String(ms) } },
      );
    }

    return NextResponse.json(
      { allowed: true, ms },
      { headers: { "Cache-Control": "no-store", "X-Aegis-Latency-Ms": String(ms) } },
    );
  } catch (err) {
    const ms = Date.now() - t0;
    console.error("[aegis:verify:edge]", err);
    return NextResponse.json(
      { allowed: true, degraded: true, ms },
      { headers: { "Cache-Control": "no-store", "X-Aegis-Latency-Ms": String(ms) } },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, service: "aegis-verify", runtime: "edge" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
