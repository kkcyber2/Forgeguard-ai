"use client";

import * as React from "react";
import {
  applyThemeToDocument,
  readThemeCookie,
  writeThemeCookie,
  type ThemeMode,
} from "@/lib/theme/constants";
import { setThemePreference, syncThemeFromProfile } from "@/lib/theme/theme-actions";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemeMode;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = React.useState<ThemeMode>(initialTheme);
  const syncedRef = React.useRef(false);

  const apply = React.useCallback((next: ThemeMode) => {
    setThemeState(next);
    applyThemeToDocument(next);
    writeThemeCookie(next);
  }, []);

  React.useEffect(() => {
    const cookieTheme = readThemeCookie();
    apply(cookieTheme);
  }, [apply]);

  React.useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    void syncThemeFromProfile().then((resolved) => {
      if (resolved !== readThemeCookie()) {
        apply(resolved);
      }
    });
  }, [apply]);

  const setTheme = React.useCallback(
    (next: ThemeMode) => {
      apply(next);
      void setThemePreference(next);
    },
    [apply],
  );

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
