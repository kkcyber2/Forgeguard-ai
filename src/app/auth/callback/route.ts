import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * OAuth / magic-link callback.
 * Exchanges the short-lived `code` param for a session cookie, then
 * redirects to the requested `next` path (safelisted to same-origin).
 *
 * Sprint 8: New accounts that haven't chosen their identity are redirected
 * to /auth/signup/identity. Detected via account age < 10 min AND
 * access_level still at default (1).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code      = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next      = nextParam.startsWith("/") ? nextParam : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !user) {
    console.error("[auth:callback] exchange failed:", error?.message);
    return NextResponse.redirect(`${origin}/auth/login?error=exchange_failed`);
  }

  // ── Sprint 8: Route new users to identity selection ───────────────
  const accountAge = Date.now() - new Date(user.created_at).getTime();
  const isVeryNew  = accountAge < 10 * 60 * 1000; // 10 minutes

  if (isVeryNew) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("access_level")
      .eq("id", user.id)
      .single();

    // access_level 1 = still at default, identity not chosen yet
    if (!profile || profile.access_level === 1) {
      return NextResponse.redirect(`${origin}/auth/signup/identity`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
