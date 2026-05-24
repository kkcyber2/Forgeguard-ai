/**
 * /api/repos/files
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  ?repo_id=<uuid>                  — list files in a repo
 * POST { repo_id, path, name, data }    — upload/upsert a file (base64 data)
 * DELETE ?id=<uuid>                     — delete a file by repo_files.id
 *
 * Storage bucket: hacker-repos (private, service-role for all ops)
 * DB table:       repo_files  (RLS: user_id = auth.uid())
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "hacker-repos";

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const repoId = req.nextUrl.searchParams.get("repo_id");
  if (!repoId) return NextResponse.json({ error: "repo_id required" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("repo_files")
    .select("id, path, name, size_bytes, mime_type, storage_key, created_at, updated_at")
    .eq("repo_id", repoId)
    .eq("user_id", user.id)
    .order("path");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, files: data ?? [] });
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { repo_id?: string; path?: string; name?: string; data?: string; mime_type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { repo_id, path, name, data: b64, mime_type } = body;
  if (!repo_id || !path || !name || !b64) {
    return NextResponse.json({ error: "repo_id, path, name, data required" }, { status: 422 });
  }

  const storageKey  = `${user.id}/${repo_id}/${path}`;
  const fileBuffer  = Buffer.from(b64, "base64");
  const contentType = mime_type ?? "text/plain";

  const admin = createAdminSupabase();
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storageKey, fileBuffer, { contentType, upsert: true });

  if (uploadErr) {
    console.error("[repos/files POST] storage:", uploadErr.message);
    return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
  }

  const supabase = await createServerSupabase();
  const { data, error: dbErr } = await supabase
    .from("repo_files")
    .upsert(
      {
        repo_id,
        user_id:     user.id,
        path,
        name,
        size_bytes:  fileBuffer.byteLength,
        mime_type:   contentType,
        storage_key: storageKey,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: "repo_id,path" },
    )
    .select()
    .single();

  if (dbErr) {
    console.error("[repos/files POST] db:", dbErr.message);
    return NextResponse.json({ error: "DB write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, file: data }, { status: 201 });
}

// ── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fileId = req.nextUrl.searchParams.get("id");
  if (!fileId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: row, error: fetchErr } = await supabase
    .from("repo_files")
    .select("storage_key")
    .eq("id", fileId)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminSupabase();
  await admin.storage.from(BUCKET).remove([row.storage_key]);
  await supabase.from("repo_files").delete().eq("id", fileId);

  return NextResponse.json({ ok: true });
}
