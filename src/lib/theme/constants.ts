export const THEME_COOKIE = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type ThemeMode = "dark" | "light";

export const DEFAULT_THEME: ThemeMode = "dark";

export function parseTheme(value: string | null | undefined): ThemeMode {
  return value === "light" ? "light" : "dark";
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light-mode", theme === "light");
}

export function writeThemeCookie(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${THEME_COOKIE_MAX_AGE};SameSite=Lax`;
}

export function readThemeCookie(): ThemeMode {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]+)`));
  return parseTheme(match?.[1]);
}
