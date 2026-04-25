import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * OAuth / magic-link callback.
 * Exchanges the short-lived `code` param for a session cookie, then
 * redirects to the requested `next` path (safelisted to same-origin).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") ? nextParam : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth:callback] exchange failed:", error.message);
    return NextResponse.redirect(`${origin}/auth/login?error=exchange_failed`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
