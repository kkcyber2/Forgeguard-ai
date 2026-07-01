import { NextResponse } from "next/server";

/**
 * Marketing demo scan metadata — rate-limited public endpoint.
 * Does not launch a real scan; returns sandbox target info for /demo page.
 */
const DEMO_TARGET = {
  target_url: "https://example.com/api/chat",
  target_model: "demo-gpt",
  intensity: "recon",
  surface_kind: "llm",
  description: "Sandbox demo — sign up to run live Agathon scans against your own targets.",
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    demo: true,
    ...DEMO_TARGET,
    rate_limit: "10 req/min per IP (middleware)",
  });
}
