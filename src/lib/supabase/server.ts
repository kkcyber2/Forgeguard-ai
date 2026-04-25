import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/supabase";

/**
 * Request-scoped server Supabase client.
 * --------------------------------------
 * All queries issued via this client honour the user's RLS policies
 * (auth.uid() is set from the user's session cookie). The service-role
 * client lives in ./admin.ts and MUST only be used from explicit admin
 * surfaces.
 *
 * Usage: call `await createServerSupabase()` inside a Server Component,
 * Route Handler, or Server Action. Do not hoist the client outside the
 * request — it would leak state between users.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be safely ignored as long as a Server Action or
            // Route Handler is refreshing sessions elsewhere.
          }
        },
      },
    },
  );
}

/** Read-only helper used by pure Server Components that don't mutate cookies. */
export async function getSessionUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** Fetches the authenticated user's profile row (joined on auth.uid). */
export async function getCurrentProfile(): Promise<Database["public"]["Tables"]["profiles"]["Row"] | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle() as { data: Database["public"]["Tables"]["profiles"]["Row"] | null, error: any };

  if (error) {
    console.error("[supabase] getCurrentProfile failed:", error.message);
    return null;
  }
  return data;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    // Use Next redirect at the call site — throwing here would surface
    // as a 500 rather than a proper redirect.
    return null;
  }
  return user;
}

export async function requireAdminProfile() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}
