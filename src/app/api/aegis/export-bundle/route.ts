/**
 * POST /api/aegis/export-bundle
 * ─────────────────────────────────────────────────────────────────────────────
 * Aegis 2.0 — Universal Rule Bundle
 *
 * Returns a hand-rolled PKZIP (.zip) containing three files:
 *   cloudflare_waf.json   -- Cloudflare Firewall Rules JSON
 *   python_middleware.py  -- FastAPI / Django ASGI middleware
 *   nextjs_shield.ts      -- Next.js Edge middleware.ts
 *
 * Uses STORED compression method (method = 0) -- no deflate required.
 * CRC-32 computed with a standard lookup table.
 *
 * Body: { scan_id: string }
 * Response: application/zip  attachment; filename="aegis-bundle-{scanId}.zip"
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildCloudflareRuleset,
  buildPythonMiddleware,
  buildNextjsShield,
  DEFAULT_SEED_FINDINGS,
  type ScanFinding,
} from "@/lib/aegis/rule-generators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── CRC-32 ───────────────────────────────────────────────────────────────────

const CRC_TABLE = (function () {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── PKZIP builder (STORED / no compression) ─────────────────────────────────

interface ZipEntry {
  name: string;
  data: Buffer;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const now = new Date();
  const dosTime =
    ((now.getSeconds() >> 1) |
      (now.getMinutes() << 5) |
      (now.getHours() << 11)) &
    0xffff;
  const dosDate =
    (now.getDate() |
      ((now.getMonth() + 1) << 5) |
      ((now.getFullYear() - 1980) << 9)) &
    0xffff;

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const size = entry.data.length;
    const crc = crc32(entry.data);

    // Local file header (30 bytes + name + data)
    const local = Buffer.allocUnsafe(30 + nameBytes.length + size);
    local.writeUInt32LE(0x04034b50, 0);  // signature
    local.writeUInt16LE(20, 4);           // version needed (2.0)
    local.writeUInt16LE(0, 6);            // general purpose bit flag
    local.writeUInt16LE(0, 8);            // compression method: STORED
    local.writeUInt16LE(dosTime, 10);     // last mod time
    local.writeUInt16LE(dosDate, 12);     // last mod date
    local.writeUInt32LE(crc, 14);         // crc-32
    local.writeUInt32LE(size, 18);        // compressed size
    local.writeUInt32LE(size, 22);        // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26); // file name length
    local.writeUInt16LE(0, 28);           // extra field length
    nameBytes.copy(local, 30);
    entry.data.copy(local, 30 + nameBytes.length);

    offsets.push(offset);
    offset += local.length;
    localParts.push(local);

    // Central directory entry (46 bytes + name)
    const central = Buffer.allocUnsafe(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4);          // version made by
    central.writeUInt16LE(20, 6);          // version needed
    central.writeUInt16LE(0, 8);           // general purpose bit flag
    central.writeUInt16LE(0, 10);          // compression method: STORED
    central.writeUInt16LE(dosTime, 12);    // last mod time
    central.writeUInt16LE(dosDate, 14);    // last mod date
    central.writeUInt32LE(crc, 16);        // crc-32
    central.writeUInt32LE(size, 20);       // compressed size
    central.writeUInt32LE(size, 24);       // uncompressed size
    central.writeUInt16LE(nameBytes.length, 28); // file name length
    central.writeUInt16LE(0, 30);          // extra field length
    central.writeUInt16LE(0, 32);          // file comment length
    central.writeUInt16LE(0, 34);          // disk number start
    central.writeUInt16LE(0, 36);          // internal file attributes
    central.writeUInt32LE(0, 38);          // external file attributes
    central.writeUInt32LE(offsets[offsets.length - 1]!, 42); // local header offset
    nameBytes.copy(central, 46);

    centralParts.push(central);
  }

  // Central directory
  const centralDir = Buffer.concat(centralParts);
  const cdirOffset = offset;
  const cdirSize   = centralDir.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.allocUnsafe(22);
  eocd.writeUInt32LE(0x06054b50, 0);      // signature
  eocd.writeUInt16LE(0, 4);               // disk number
  eocd.writeUInt16LE(0, 6);               // disk with start of central directory
  eocd.writeUInt16LE(entries.length, 8);  // entries on disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(cdirSize, 12);       // size of central directory
  eocd.writeUInt32LE(cdirOffset, 16);     // offset of central directory
  eocd.writeUInt16LE(0, 20);              // comment length

  return Buffer.concat([...localParts, centralDir, eocd]);
}

// ─── Request schema ───────────────────────────────────────────────────────────

const BundleSchema = z.object({
  scan_id: z.string().uuid(),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  let reqBody: unknown;
  try {
    reqBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BundleSchema.safeParse(reqBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "scan_id must be a valid UUID" },
      { status: 400 },
    );
  }

  const { scan_id: scanId } = parsed.data;

  // Verify scan belongs to user
  const { data: scan, error: scanErr } = await supabase
    .from("scans")
    .select("id, user_id, status")
    .eq("id", scanId)
    .single();

  if (scanErr || !scan) {
    return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });
  }
  if (scan.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: report } = await supabase
    .from("scan_reports")
    .select("findings")
    .eq("scan_id", scanId)
    .maybeSingle();

  const findings: ScanFinding[] =
    report?.findings && Array.isArray(report.findings) && report.findings.length > 0
      ? (report.findings as unknown as ScanFinding[])
      : DEFAULT_SEED_FINDINGS;

  // Generate all three rule sets
  const cfRuleset = buildCloudflareRuleset(scanId, findings);
  const pyMiddle  = buildPythonMiddleware(scanId, findings);
  const njsShield = buildNextjsShield(scanId, findings);

  // Persist rules is best-effort — skip if schema mismatch
  void supabase
    .from("aegis_rules")
    .insert({
      scan_id: scanId,
      rule_id: `bundle-${scanId.slice(0, 8)}`,
      pattern: (findings[0]?.attack_name ?? "forgeguard-export").slice(0, 500),
      description: "Aegis bundle export",
      action: "block",
      format: "cloudflare",
      enabled: true,
    })
    .then(() => undefined, () => undefined);

  // Assemble ZIP entries
  const entries: ZipEntry[] = [
    { name: "cloudflare_waf.json",  data: Buffer.from(JSON.stringify(cfRuleset, null, 2), "utf8") },
    { name: "python_middleware.py", data: Buffer.from(pyMiddle, "utf8") },
    { name: "nextjs_shield.ts",     data: Buffer.from(njsShield, "utf8") },
  ];

  const zipBuffer  = buildZip(entries);
  const bundleName = "aegis-bundle-" + scanId.slice(0, 8) + ".zip";

  // NextResponse BodyInit does not accept Node Buffer; use Uint8Array view
  const responseBody = new Uint8Array(
    zipBuffer.buffer,
    zipBuffer.byteOffset,
    zipBuffer.byteLength,
  );

  return new NextResponse(responseBody as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": "attachment; filename=" + bundleName,
      "Content-Length":      String(zipBuffer.length),
      "Cache-Control":       "no-store",
    },
  });
}
