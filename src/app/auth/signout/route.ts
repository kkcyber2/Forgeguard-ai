import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /auth/signout — clears the Supabase session cookie and redirects
 * the user to the landing page. Accepts POST only to prevent link-based
 * CSRF sign-out pranks.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
