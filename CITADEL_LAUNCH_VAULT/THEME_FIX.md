# Theme fix — dark / light mode (P0 UX)

**Date:** 2026-06-13  
**Issue:** `layout.tsx` forced `className="dark"` on `<html>` while `top-bar.tsx` only toggled `light-mode`. `profiles.theme_preference` existed but was never read or written.

---

## Root cause

| Layer | Before | After |
|-------|--------|-------|
| `<html>` class | Always `dark` (Tailwind) | `light-mode` when light; no forced `dark` |
| Toggle | Cookie + `light-mode` only | Cookie + `light-mode` + DB sync |
| Profile | `theme_preference` unused | Read on login, written on toggle |
| Semantic colors | Hardcoded hex in Tailwind | CSS variables (`--fg-*`) |
| Flash | Theme applied after hydration | Inline `ThemeScript` before paint |

---

## Architecture

```
ThemeScript (inline)     → reads cookie → sets .light-mode before paint
getServerTheme()         → SSR html class matches cookie
ThemeProvider            → context + syncThemeFromProfile() on mount
setThemePreference()     → cookie + profiles.theme_preference
top-bar toggle           → useTheme().toggleTheme()
```

### Files

| File | Role |
|------|------|
| `src/lib/theme/constants.ts` | Cookie name, parse/apply helpers |
| `src/lib/theme/server.ts` | `getServerTheme()` for layout SSR |
| `src/lib/theme/theme-actions.ts` | `setThemePreference`, `syncThemeFromProfile` |
| `src/components/theme/theme-script.tsx` | Anti-flash inline script |
| `src/components/theme/theme-provider.tsx` | React context + profile sync |
| `src/app/layout.tsx` | Removed forced `dark`; wires provider |
| `src/app/globals.css` | `--fg-*` tokens + light-mode overrides |
| `tailwind.config.ts` | Semantic colors → CSS variables |

---

## Persistence

- **Cookie:** `theme=dark|light` (1 year, `SameSite=Lax`, path `/`)
- **Database:** `profiles.theme_preference` (`dark` | `light`)
- **Sync rule:** On authenticated load, profile wins if set; otherwise cookie is backfilled to profile

---

## Light mode coverage

CSS variable tokens apply to `bg-background`, `text-foreground`, `bg-surface`, `border-border`, etc.

Additional `html.light-mode` overrides for:

- Dashboard header / sovereign sidebar (`.fg-sidebar*`)
- Obsidian utility classes (`bg-obsidian-*`)
- White border/text utilities used on scan + intel pages
- Marketing nav scroll backdrop (theme-aware framer values)
- App grain overlay hidden

---

## Manual test checklist

1. **Dashboard** — toggle sun/moon in top bar; cards and sidebar readable in both modes
2. **Scans** — `/dashboard/scans` and `/dashboard/scans/[id]` — borders/text contrast OK
3. **Settings** — `/dashboard/settings` — clearance section readable in light mode
4. **Marketing** — `/` — set light in dashboard, visit home; nav backdrop light
5. **Persistence** — toggle light → refresh → still light; sign out/in → preference restored from profile
6. **No flash** — hard refresh should not flash wrong theme

---

## Build

```bash
npm run build
```

Expected: PASS (no scan or OpenRouter required).
