import { THEME_COOKIE } from "@/lib/theme/constants";

/**
 * Inline script — runs before first paint to avoid theme flash.
 * Must stay in sync with ThemeProvider + getServerTheme().
 */
export function ThemeScript() {
  const script = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]+)/);var t=m&&m[1]==='light'?'light':'dark';document.documentElement.classList.toggle('light-mode',t==='light');}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
