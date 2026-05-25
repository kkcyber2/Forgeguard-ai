import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SOVEREIGN_VIOLATION_LOGIN } from "@/lib/auth/sovereign-violation";

export const runtime = "nodejs";

/**
 * GET /auth/force-logout — clears session (middleware redirect target).
 */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL(SOVEREIGN_VIOLATION_LOGIN, request.url));
  }

  let response = NextResponse.redirect(new URL(SOVEREIGN_VIOLATION_LOGIN, request.url));

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.signOut();
  return response;
}
