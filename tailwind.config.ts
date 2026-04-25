import type { Config } from "tailwindcss";

/**
 * ForgeGuard AI — Design System
 * ------------------------------------------------------------
 * Single source of truth. Landing + User Dashboard + Admin all
 * consume these tokens. No ad-hoc hex values should exist
 * anywhere in the app.
 *
 * Palette doctrine (strict monochrome):
 *   - obsidian.*    : page + panel grounds
 *   - steel.*       : dividers, muted text, non-interactive chrome
 *   - acid          : reserved for Secure / Success / Active state
 *   - threat        : reserved for Vulnerability / Critical alerts
 *   - accent        : Electric Purple, reserved for Admin surfaces only
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    // Override the default radius scale — no bubbly cards.
    borderRadius: {
      none: "0",
      xs: "2px",
      sm: "4px",
      DEFAULT: "6px",
      md: "6px",
      lg: "8px",
      xl: "10px",
      full: "9999px",
    },
    extend: {
      colors: {
        // Deep obsidian grounds
        obsidian: {
          950: "#050505",
          900: "#0A0A0B",
          800: "#0F1011",
          700: "#151618",
          600: "#1C1D21",
          500: "#232428",
        },
        // Steel gray — chrome & dividers
        steel: {
          900: "#2A2B30",
          800: "#35363C",
          700: "#484951",
          600: "#5E6069",
          500: "#797B85",
          400: "#9B9DA6",
          300: "#BDBFC7",
          200: "#D9DAE0",
          100: "#ECEDF0",
        },
        // Reserved semantic signals — do NOT redeploy these for decoration.
        acid: {
          DEFAULT: "#D1FF00",
          soft: "#E4FF66",
          glow: "rgba(209, 255, 0, 0.35)",
          wash: "rgba(209, 255, 0, 0.08)",
        },
        threat: {
          DEFAULT: "#FF2E4D",
          soft: "#FF6B80",
          glow: "rgba(255, 46, 77, 0.35)",
          wash: "rgba(255, 46, 77, 0.08)",
        },
        accent: {
          DEFAULT: "#A855F7",
          soft: "#C084FC",
          glow: "rgba(168, 85, 247, 0.35)",
          wash: "rgba(168, 85, 247, 0.08)",
        },
        // Semantic aliases consumed by UI primitives
        background: "#050505",
        surface: "#0A0A0B",
        "surface-raised": "#0F1011",
        border: "rgba(255, 255, 255, 0.06)",
        "border-strong": "rgba(255, 255, 255, 0.12)",
        foreground: "#ECEDF0",
        "foreground-muted": "#797B85",
        "foreground-subtle": "#5E6069",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3rem, 6vw, 5.5rem)", { lineHeight: "0.95", letterSpacing: "-0.04em", fontWeight: "600" }],
        "display-lg": ["clamp(2.5rem, 4vw, 3.75rem)", { lineHeight: "1", letterSpacing: "-0.035em", fontWeight: "600" }],
        "display-md": ["clamp(2rem, 3vw, 2.75rem)", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "600" }],
        eyebrow: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.18em", fontWeight: "500" }],
      },
      letterSpacing: {
        tightest: "-0.04em",
        "super-wide": "0.22em",
      },
      boxShadow: {
        // Subtle low-opacity glows — never drop-shadow bubbles.
        "glow-acid": "0 0 0 1px rgba(209,255,0,0.25), 0 0 24px -4px rgba(209,255,0,0.35)",
        "glow-threat": "0 0 0 1px rgba(255,46,77,0.25), 0 0 24px -4px rgba(255,46,77,0.35)",
        "glow-accent": "0 0 0 1px rgba(168,85,247,0.25), 0 0 24px -4px rgba(168,85,247,0.35)",
        "inner-hairline": "inset 0 1px 0 rgba(255,255,255,0.04)",
        "panel": "0 1px 0 rgba(255,255,255,0.03), 0 24px 48px -24px rgba(0,0,0,0.6)",
        "elevated": "0 1px 0 rgba(255,255,255,0.04), 0 32px 64px -32px rgba(0,0,0,0.8)",
      },
      backgroundImage: {
        // Grid overlay — hairline cells, drawn with CSS, not images.
        "grid-hairline":
          "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
        "grid-dense":
          "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
        "radial-obsidian":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(209,255,0,0.06), transparent 70%)",
        "radial-threat":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,46,77,0.06), transparent 70%)",
      },
      backgroundSize: {
        "grid-sm": "24px 24px",
        "grid-md": "48px 48px",
        "grid-lg": "80px 80px",
      },
      animation: {
        "pulse-acid": "pulseAcid 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-threat": "pulseThreat 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan-line": "scanLine 3.2s linear infinite",
        "marquee": "marquee 38s linear infinite",
        "fade-in-up": "fadeInUp 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "shimmer": "shimmer 2.6s linear infinite",
      },
      keyframes: {
        pulseAcid: {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(209,255,0,0.45)" },
          "50%": { opacity: "0.7", boxShadow: "0 0 0 6px rgba(209,255,0,0)" },
        },
        pulseThreat: {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(255,46,77,0.45)" },
          "50%": { opacity: "0.7", boxShadow: "0 0 0 6px rgba(255,46,77,0)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      transitionTimingFunction: {
        "out-hard": "cubic-bezier(0.2, 0.7, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
