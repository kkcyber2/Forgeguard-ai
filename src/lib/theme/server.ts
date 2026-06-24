import "server-only";

import { cookies } from "next/headers";
import { DEFAULT_THEME, parseTheme, THEME_COOKIE, type ThemeMode } from "@/lib/theme/constants";

export async function getServerTheme(): Promise<ThemeMode> {
  const cookieStore = await cookies();
  return parseTheme(cookieStore.get(THEME_COOKIE)?.value ?? DEFAULT_THEME);
}
