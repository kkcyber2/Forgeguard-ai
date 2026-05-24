/**
 * POST /api/recon/start
 * Inserts a recon_targets row and kicks off the background recon job
 * by notifying the Railway Agathon worker via its /recon/start endpoint.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { engineAuthHeaders } from "@/lib/agathon-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  target: z.string().min(1).max(512),
  depth: z.number().int().min(1).max(5).default(2),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

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

  const { data: reconRow, error } = await supabase
    .from("recon_targets")
    .insert({
      user_id: user.id,
      target: parsed.data.target,
      scan_depth: parsed.data.depth,
      status: "queued",
      surface_map: null,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const workerUrl = process.env.AGATHON_WORKER_URL ?? process.env.PYTHON_ENGINE_URL;
  const authHeaders = engineAuthHeaders();
  if (workerUrl && authHeaders) {
    fetch(`${workerUrl.replace(/\/$/, "")}/recon/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        recon_id: reconRow.id,
        target: parsed.data.target,
        depth: parsed.data.depth,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, recon: reconRow }, { status: 201 });
}
