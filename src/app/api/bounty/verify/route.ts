/**
 * POST /api/bounty/verify
 * ────────────────────────────────────────────────────────────────────────────
 * Domain ownership verification for Bounty Vault submissions.
 *
 * Actions (body.action):
 *   "issue"  — Issues a one-time DNS TXT token for the domain.
 *              Inserts a row in target_verifications (or returns existing token).
 *              Caller must add TXT record: forgeguard-verify=<token>
 *
 *   "check"  — Queries DNS for the TXT record and marks the domain verified
 *              if found. Returns { verified: true } on success.
 *
 *   "status" — Returns current verification state for the domain.
 *
 * Auth: active Supabase session required.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Schema ──────────────────────────────────────────────────────────────────

const VerifySchema = z.object({
  domain: z
    .string()
    .min(2)
    .max(253)
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9\-\.]+[a-zA-Z0-9]$/,
      "Invalid domain format",
    ),
  action: z.enum(["issue", "check", "status"]),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerificationRow {
  id:            string;
  user_id:       string;
  target_domain: string;
  method:        string;
  token:         string;
  verified:      boolean;
  verified_at:   string | null;
  expires_at:    string;
  created_at:    string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip protocol / path from input so "https://api.example.com/v1" → "api.example.com" */
function normaliseDomain(raw: string): string {
  try {
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return raw.toLowerCase().replace(/\.$/, "");
  }
}

/** Resolve TXT records for a domain, returns all flat strings. */
async function resolveTxt(domain: string): Promise<string[]> {
  const dns = await import("node:dns/promises");
  try {
    const chunks = await dns.resolveTxt(domain);
    return chunks.flat();
  } catch {
    return [];
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Bad request" },
      { status: 400 },
    );
  }

  const domain = normaliseDomain(parsed.data.domain);
  const action = parsed.data.action;

  // ── Fetch existing record ────────────────────────────────────────────────────
  const { data: existing } = (await supabase
    .from("target_verifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("target_domain", domain)
    .maybeSingle()) as { data: VerificationRow | null };

  // ── ACTION: status ────────────────────────────────────────────────────────────
  if (action === "status") {
    if (!existing) {
      return NextResponse.json({ ok: true, domain, verified: false, token: null });
    }
    return NextResponse.json({
      ok:         true,
      domain,
      verified:   existing.verified,
      verified_at:existing.verified_at,
      token:      existing.token,
      expires_at: existing.expires_at,
    });
  }

  // ── ACTION: issue ─────────────────────────────────────────────────────────────
  if (action === "issue") {
    if (existing && !isExpired(existing.expires_at)) {
      // Return the existing (possibly already verified) token
      return NextResponse.json({
        ok:       true,
        domain,
        token:    existing.token,
        verified: existing.verified,
        txt_record: `forgeguard-verify=${existing.token}`,
        instructions: dnsInstructions(domain, existing.token),
      });
    }

    // Generate a fresh token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error: upsertErr } = await supabase
      .from("target_verifications")
      .upsert(
        {
          user_id:       user.id,
          target_domain: domain,
          method:        "dns_txt",
          token,
          verified:      false,
          verified_at:   null,
          // expires_at defaults to NOW() + 7 days in the DB but let's be explicit
          expires_at:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "user_id,target_domain" },
      );

    if (upsertErr) {
      return NextResponse.json(
        { ok: false, error: "Failed to issue token: " + upsertErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok:           true,
      domain,
      token,
      verified:     false,
      txt_record:   `forgeguard-verify=${token}`,
      instructions: dnsInstructions(domain, token),
    });
  }

  // ── ACTION: check ─────────────────────────────────────────────────────────────
  if (action === "check") {
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "No verification token issued for this domain. Call action=issue first." },
        { status: 400 },
      );
    }

    if (existing.verified) {
      return NextResponse.json({ ok: true, domain, verified: true, already_verified: true });
    }

    if (isExpired(existing.expires_at)) {
      return NextResponse.json(
        { ok: false, error: "Verification token has expired. Issue a new one.", expired: true },
        { status: 400 },
      );
    }

    // Query DNS TXT records
    const txtRecords = await resolveTxt(domain);
    const expectedValue = `forgeguard-verify=${existing.token}`;
    const found = txtRecords.some((r) => r === expectedValue);

    if (!found) {
      return NextResponse.json({
        ok:             true,
        domain,
        verified:       false,
        dns_checked:    true,
        expected_txt:   expectedValue,
        found_records:  txtRecords.filter((r) => r.startsWith("forgeguard-")).slice(0, 5),
        message:        "TXT record not yet found. DNS propagation can take up to 48 hours.",
      });
    }

    // Mark as verified
    await supabase
      .from("target_verifications")
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("target_domain", domain);

    return NextResponse.json({
      ok:          true,
      domain,
      verified:    true,
      verified_at: new Date().toISOString(),
      message:     "Domain ownership confirmed via DNS TXT record.",
    });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

function dnsInstructions(domain: string, token: string): string {
  return (
    `Add the following DNS TXT record to ${domain}:\n\n` +
    `  Host: @ (or ${domain})\n` +
    `  Type: TXT\n` +
    `  Value: forgeguard-verify=${token}\n\n` +
    `After adding the record, click "Check Verification". DNS propagation may take up to 48 hours.`
  );
}
