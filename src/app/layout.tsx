// =====================================================
// Root Layout
// =====================================================

import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { validateEnvironmentVariables, logEnvironmentStatus } from '@/lib/env';
import './globals.css';

// Validate environment variables on server startup
validateEnvironmentVariables();
logEnvironmentStatus();

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ForgeGuard AI | AI Red Teaming & Secure AI/ML Agency',
  description:
    'Forging Secure AI | Red Teaming LLMs | Hardening Agents Against Real Attacks. Expert AI security services by Konain Sultan Khan.',
  keywords: [
    'AI security',
    'red teaming',
    'LLM security',
    'prompt injection',
    'AI safety',
    'machine learning security',
    'secure AI agents',
    'AI audit',
    'Konain Sultan Khan',
  ],
  authors: [{ name: 'Konain Sultan Khan' }],
  creator: 'Konain Sultan Khan',
  publisher: 'ForgeGuard AI',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://forgeguard.ai',
    siteName: 'ForgeGuard AI',
    title: 'ForgeGuard AI | AI Red Teaming & Secure AI/ML Agency',
    description:
      'Forging Secure AI | Red Teaming LLMs | Hardening Agents Against Real Attacks',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'ForgeGuard AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ForgeGuard AI | AI Red Teaming & Secure AI/ML Agency',
    description:
      'Forging Secure AI | Red Teaming LLMs | Hardening Agents Against Real Attacks',
    images: ['/og-image.jpg'],
    creator: '@konainsultan',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#00f0ff',
      },
    ],
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} dark`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground antialiased neural-bg min-h-screen">
        {children}
      </body>
    </html>
  );
}
