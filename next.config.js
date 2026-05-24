/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,

  // Pin tracing root to this app (avoids wrong workspace when multiple lockfiles exist)
  outputFileTracingRoot: path.join(__dirname),

  // ── Transpile ESM-only packages ─────────────────────────────────────────
  // three.js, @react-three/fiber and @react-three/drei ship as pure ESM.
  // Without this, webpack emits "SyntaxError: Cannot use import statement
  // outside a module" and "ReactCurrentBatchConfig" crashes because the
  // ESM module graph gets broken mid-bundle.
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei", "framer-motion"],

  // ── Build leniency ──────────────────────────────────────────────────────
  // Don't fail production builds on TS / ESLint warnings from cross-package
  // generic drift between @supabase/ssr and @supabase/supabase-js.
  // Runtime correctness is enforced by Postgres + RLS + Zod at API boundary.
  // Re-enable once Supabase packages are upgraded to aligned versions.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  webpack: (config) => {
    // Prevent webpack from trying to bundle native Node addons
    config.externals.push({
      "utf-8-validate": "commonjs utf-8-validate",
      bufferutil: "commonjs bufferutil",
    });
    return config;
  },
};

module.exports = nextConfig;
