import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "ForgeGuard AI — Adversarial Intelligence Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#050505",
          color: "#fafafa",
          fontFamily: "monospace",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: "0.2em", color: "#D1FF00" }}>
          // FORGEGUARD AI
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, marginTop: 24, lineHeight: 1.1 }}>
          Adversarial Intelligence
        </div>
        <div style={{ fontSize: 28, marginTop: 16, color: "rgba(255,255,255,0.55)" }}>
          Red-teaming · Runtime guardrails · Genesis 3.0
        </div>
      </div>
    ),
    { ...size },
  );
}
