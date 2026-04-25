import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { assertPublicEnv } from "@/lib/env";
import "./globals.css";

/**
 * Root layout. Server Component.
 * No Supabase client created here — server components that need auth
 * should import from @/lib/supabase/server and create a request-scoped
 * client. Never instantiate a Supabase client at module scope.
 */

// Fail fast on boot if public env is misconfigured.
assertPublicEnv();

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://forgeguard.ai",
  ),
  title: {
    default: "ForgeGuard AI — Adversarial Red-Teaming for LLMs",
    template: "%s · ForgeGuard AI",
  },
  description:
    "Continuous red-teaming, runtime guardrails, and prompt-injection defense for production LLM deployments. Engineered for security teams.",
  keywords: [
    "LLM security",
    "AI red teaming",
    "prompt injection",
    "AI guardrails",
    "adversarial testing",
    "agent security",
    "ForgeGuard",
  ],
  authors: [{ name: "ForgeGuard AI" }],
  openGraph: {
    type: "website",
    siteName: "ForgeGuard AI",
    title: "ForgeGuard AI — Adversarial Red-Teaming for LLMs",
    description:
      "Continuous red-teaming and runtime guardrails for production LLM deployments.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ForgeGuard AI",
    description:
      "Adversarial red-teaming and runtime guardrails for production LLM deployments.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground antialiased selection:bg-acid/25">
        {/* Ambient grain — single fixed layer for the entire app */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
