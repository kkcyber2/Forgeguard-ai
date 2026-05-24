/**
 * GET /api/repos/zip/[repoId]
 * ─────────────────────────────────────────────────────────────────────────────
 * Downloads all files in a repo as a PKZIP archive.
 * Zero external dependencies — hand-rolled CRC-32 + ZIP 2.0 spec.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "hacker-repos";

// ── CRC-32 ───────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── Little-endian helpers ─────────────────────────────────────────────────────
function u16(v: number, a: Uint8Array, o: number) {
  a[o] = v & 0xff; a[o + 1] = (v >> 8) & 0xff;
}
function u32(v: number, a: Uint8Array, o: number) {
  a[o] = v & 0xff; a[o + 1] = (v >> 8) & 0xff;
  a[o + 2] = (v >> 16) & 0xff; a[o + 3] = (v >> 24) & 0xff;
}

// ── PKZIP builder ─────────────────────────────────────────────────────────────
function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc     = new TextEncoder();
  const locals: Uint8Array[]  = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nb  = enc.encode(name);
    const crc = crc32(data);

    // Local file header (30 + name)
    const lh = new Uint8Array(30 + nb.length);
    u32(0x04034b50, lh, 0);   // signature
    u16(20,         lh, 4);   // version needed
    u16(0,          lh, 6);   // flags
    u16(0,          lh, 8);   // method: stored
    u16(0,          lh, 10);  // mod time
    u16(0,          lh, 12);  // mod date
    u32(crc,        lh, 14);
    u32(data.length, lh, 18); // compressed size
    u32(data.length, lh, 22); // uncompressed size
    u16(nb.length,  lh, 26);
    u16(0,          lh, 28);  // extra length
    lh.set(nb, 30);

    // Central directory entry (46 + name)
    const cd = new Uint8Array(46 + nb.length);
    u32(0x02014b50, cd, 0);
    u16(20,         cd, 4);
    u16(20,         cd, 6);
    u16(0,          cd, 8);
    u16(0,          cd, 10);
    u16(0,          cd, 12);
    u16(0,          cd, 14);
    u32(crc,        cd, 16);
    u32(data.length, cd, 20);
    u32(data.length, cd, 24);
    u16(nb.length,  cd, 28);
    u16(0,          cd, 30); // extra
    u16(0,          cd, 32); // comment
    u16(0,          cd, 34); // disk start
    u16(0,          cd, 36); // int attrs
    u32(0,          cd, 38); // ext attrs
    u32(offset,     cd, 42); // local offset
    cd.set(nb, 46);

    locals.push(lh, data);
    central.push(cd);
    offset += lh.length + data.length;
  }

  const cdOffset = offset;
  const cdSize   = central.reduce((s, e) => s + e.length, 0);

  // End of central directory record
  const eocd = new Uint8Array(22);
  u32(0x06054b50,    eocd, 0);
  u16(0,             eocd, 4);
  u16(0,             eocd, 6);
  u16(files.length,  eocd, 8);
  u16(files.length,  eocd, 10);
  u32(cdSize,        eocd, 12);
  u32(cdOffset,      eocd, 16);
  u16(0,             eocd, 20);

  const all   = [...locals, ...central, eocd];
  const total = all.reduce((s, a) => s + a.length, 0);
  const out   = new Uint8Array(total);
  let pos = 0;
  for (const a of all) { out.set(a, pos); pos += a.length; }
  return out;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { repoId } = await params;
  const supabase   = await createServerSupabase();
  const admin      = createAdminSupabase();

  // Verify ownership
  const { data: repo } = await supabase
    .from("hacker_repos")
    .select("id, name")
    .eq("id", repoId)
    .eq("owner_id", user.id)
    .single();

  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch file manifest
  const { data: rows } = await supabase
    .from("repo_files")
    .select("path, storage_key")
    .eq("repo_id", repoId)
    .eq("user_id", user.id);

  if (!rows?.length) {
    return NextResponse.json({ error: "No files in repo" }, { status: 404 });
  }

  // Download each object from Storage
  const files: { name: string; data: Uint8Array }[] = [];
  for (const row of rows) {
    const { data: blob, error } = await admin.storage
      .from(BUCKET)
      .download(row.storage_key);
    if (error || !blob) continue;
    files.push({ name: row.path, data: new Uint8Array(await blob.arrayBuffer()) });
  }

  if (!files.length) {
    return NextResponse.json({ error: "No downloadable files" }, { status: 404 });
  }

  const zip      = buildZip(files);
  const safeSlug = (repo.name as string).replace(/[^a-z0-9_\-]/gi, "_");

  return new NextResponse(zip as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="${safeSlug}.zip"`,
      "Content-Length":      String(zip.length),
    },
  });
}
