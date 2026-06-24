"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_THEME,
  parseTheme,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type ThemeMode,
} from "@/lib/theme/constants";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";

/** Persist theme to cookie + profiles.theme_preference when authenticated. */
export async function setThemePreference(theme: ThemeMode): Promise<{ ok: true } | { error: string }> {
  if (theme !== "dark" && theme !== "light") {
    return { error: "Invalid theme." };
  }

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  const user = await getSessionUser();
  if (user) {
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({ theme_preference: theme })
      .eq("id", user.id);
    if (error) return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * On login / app load: profile preference wins; backfill profile from cookie when empty.
 */
export async function syncThemeFromProfile(): Promise<ThemeMode> {
  const cookieStore = await cookies();
  const cookieTheme = parseTheme(cookieStore.get(THEME_COOKIE)?.value ?? DEFAULT_THEME);

  const user = await getSessionUser();
  if (!user) return cookieTheme;

  const supabase = await createServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("theme_preference")
    .eq("id", user.id)
    .maybeSingle();

  const profileTheme = profile?.theme_preference
    ? parseTheme(profile.theme_preference)
    : null;

  if (profileTheme) {
    if (profileTheme !== cookieTheme) {
      cookieStore.set(THEME_COOKIE, profileTheme, {
        path: "/",
        maxAge: THEME_COOKIE_MAX_AGE,
        sameSite: "lax",
      });
    }
    return profileTheme;
  }

  await supabase
    .from("profiles")
    .update({ theme_preference: cookieTheme })
    .eq("id", user.id);

  return cookieTheme;
}
