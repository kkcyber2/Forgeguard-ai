/**
 * GET /auth/oauth?provider=github|google|discord&next=<path>
 * ──────────────────────────────────────────────────────────────────────────
 * Initiates an OAuth flow with Supabase. The browser hits this route,
 * we ask Supabase for the provider's authorization URL, and we redirect
 * the browser there. After the user authenticates, the provider redirects
 * back to /auth/callback which exchanges the code for a session.
 *
 * Setup checklist (Supabase Dashboard → Authentication → Providers):
 *
 *   GitHub
 *     - Enable GitHub provider
 *     - Create OAuth App at github.com/settings/developers
 *     - Homepage URL:       https://your-app.com
 *     - Authorization callback URL: https://<project>.supabase.co/auth/v1/callback
 *     - Paste Client ID + Client Secret into Supabase
 *
 *   Google
 *     - Enable Google provider
 *     - Create OAuth 2.0 credentials at console.cloud.google.com
 *     - Authorized redirect URI: https://<project>.supabase.co/auth/v1/callback
 *     - Paste Client ID + Client Secret into Supabase
 *
 *   Discord
 *     - Enable Discord provider
 *     - Create app at discord.com/developers/applications
 *     - OAuth2 Redirect URI: https://<project>.supabase.co/auth/v1/callback
 *     - Paste Client ID + Client Secret into Supabase
 *
 * No env vars needed in Next.js — all OAuth credentials live in Supabase.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Provider } from "@supabase/supabase-js";

const ALLOWED_PROVIDERS: Provider[] = ["github", "google", "discord"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const provider = searchParams.get("provider") as Provider | null;
  const next = searchParams.get("next") ?? "/dashboard";
  // Safety: only allow same-origin redirects after auth
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=unsupported_provider`,
    );
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      // Request email scope so we can store it in profiles
      scopes: provider === "github" ? "read:user user:email" : undefined,
    },
  });

  if (error || !data.url) {
    console.error("[auth/oauth] provider error:", error?.message);
    return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`);
  }

  return NextResponse.redirect(data.url);
}
