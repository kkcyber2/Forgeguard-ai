import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/verify-domain
 * Generate a domain verification token and store it on the profile.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Call the DB function to generate + persist the token
  const admin = createAdminSupabase();
  const { data: token, error: fnErr } = await admin.rpc("generate_domain_token", {
    p_user_id: user.id,
  });

  if (fnErr || !token) {
    console.error("[verify-domain] generate token failed:", fnErr?.message);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }

  return NextResponse.json({ token });
}

/**
 * PUT /api/verify-domain
 * Check DNS TXT record and mark profile as domain_verified if found.
 * Reads domain from profile's email domain (best effort for SaaS flow).
 */
export async function PUT() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch token from profile
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("domain_token, domain_verified")
    .eq("id", user.id)
    .single();

  if (profErr || !profile?.domain_token) {
    return NextResponse.json({ error: "No verification token found. Generate one first." }, { status: 400 });
  }
  if (profile.domain_verified) {
    return NextResponse.json({ ok: true, already: true });
  }

  // Derive domain from email
  const emailDomain = user.email?.split("@")[1];
  if (!emailDomain) {
    return NextResponse.json({ error: "Cannot derive domain from account email." }, { status: 400 });
  }

  // DNS lookup via Google's DNS-over-HTTPS API
  const expectedRecord = `forgeguard-verify=${profile.domain_token}`;
  try {
    const dnsUrl = `https://dns.google/resolve?name=${emailDomain}&type=TXT`;
    const dnsRes = await fetch(dnsUrl, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!dnsRes.ok) {
      return NextResponse.json({ error: "DNS lookup failed. Try again shortly." }, { status: 502 });
    }

    interface DnsAnswer { data: string }
    const dnsJson = await dnsRes.json() as { Answer?: DnsAnswer[] };
    const answers = dnsJson.Answer ?? [];

    const found = answers.some((a) =>
      a.data.replace(/"/g, "").trim() === expectedRecord,
    );

    if (!found) {
      return NextResponse.json({
        ok:    false,
        error: `TXT record not found for ${emailDomain}. Add: ${expectedRecord}`,
      });
    }

    // Mark verified
    const admin = createAdminSupabase();
    await admin
      .from("profiles")
      .update({ domain_verified: true })
      .eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[verify-domain] DNS check error:", e);
    return NextResponse.json({ error: "DNS lookup timed out. Check your record and retry." }, { status: 504 });
  }
}
