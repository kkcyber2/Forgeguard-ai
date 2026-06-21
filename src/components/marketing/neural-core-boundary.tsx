"use client";
/**
 * NeuralCoreBoundary
 * ------------------
 * React Error Boundary wrapping the R3F NeuralCore sphere.
 * If WebGL initialisation or any render-loop error is thrown, the boundary
 * catches it and swaps in a high-quality static SVG core — the user never
 * sees a white screen or crash banner.
 */

import * as React from "react";
import { NeuralCore } from "@/components/marketing/neural-core";

/* ── Static SVG fallback — acid-green sovereign core ──────────────────── */
function StaticCore({ className }: { className?: string }) {
  return (
    <div
      className={className}
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 480 480"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "min(480px, 70vw)", height: "min(480px, 70vw)", opacity: 0.35 }}
      >
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D1FF00" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#D1FF00" stopOpacity="0" />
          </radialGradient>
          <style>{`
            @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes spinFast { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
            @keyframes pulseCore { 0%,100% { opacity:0.7; } 50% { opacity:1; } }
            .ring-a { transform-origin:240px 240px; animation: spinSlow 18s linear infinite; }
            .ring-b { transform-origin:240px 240px; animation: spinFast 12s linear infinite; }
            .core-pulse { transform-origin:240px 240px; animation: pulseCore 3s ease-in-out infinite; }
          `}</style>
        </defs>

        {/* Ambient glow */}
        <circle cx="240" cy="240" r="200" fill="url(#coreGlow)" />

        {/* Dot grid */}
        {Array.from({ length: 11 }, (_, row) =>
          Array.from({ length: 11 }, (_, col) => {
            const cx = 80 + col * 32;
            const cy = 80 + row * 32;
            const dx = cx - 240, dy = cy - 240;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 185) return null;
            const op = 0.08 + (1 - d / 185) * 0.18;
            return <circle key={`${row}-${col}`} cx={cx} cy={cy} r="1.2" fill="#D1FF00" opacity={op} />;
          })
        )}

        {/* Outer ring dashes */}
        <g className="ring-a">
          <circle cx="240" cy="240" r="170" fill="none" stroke="#D1FF00" strokeWidth="0.5" strokeOpacity="0.25" strokeDasharray="4 8" />
        </g>

        {/* Mid ring dashes */}
        <g className="ring-b">
          <circle cx="240" cy="240" r="130" fill="none" stroke="#D1FF00" strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="6 10" />
        </g>

        {/* Static rings */}
        <circle cx="240" cy="240" r="90" fill="none" stroke="#D1FF00" strokeWidth="0.5" strokeOpacity="0.2" />
        <circle cx="240" cy="240" r="55" fill="none" stroke="#D1FF00" strokeWidth="0.5" strokeOpacity="0.3" />

        {/* Cross-hairs */}
        <line x1="240" y1="60" x2="240" y2="420" stroke="#D1FF00" strokeWidth="0.4" strokeOpacity="0.1" />
        <line x1="60" y1="240" x2="420" y2="240" stroke="#D1FF00" strokeWidth="0.4" strokeOpacity="0.1" />

        {/* Core orb */}
        <g className="core-pulse">
          <circle cx="240" cy="240" r="22" fill="#D1FF00" fillOpacity="0.08" />
          <circle cx="240" cy="240" r="14" fill="#D1FF00" fillOpacity="0.15" />
          <circle cx="240" cy="240" r="7"  fill="#D1FF00" fillOpacity="0.9" />
        </g>

        {/* Tick marks */}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * 2 * Math.PI;
          const r1 = 165, r2 = i % 6 === 0 ? 155 : 159;
          return (
            <line
              key={i}
              x1={240 + r1 * Math.cos(a)} y1={240 + r1 * Math.sin(a)}
              x2={240 + r2 * Math.cos(a)} y2={240 + r2 * Math.sin(a)}
              stroke="#D1FF00" strokeWidth={i % 6 === 0 ? 1.2 : 0.6} strokeOpacity="0.4"
            />
          );
        })}
      </svg>
    </div>
  );
}

/* ── Error Boundary ────────────────────────────────────────────────────── */
interface State { crashed: boolean }

export class NeuralCoreBoundary extends React.Component<
  { className?: string },
  State
> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Silent in production; log in dev
    if (process.env.NODE_ENV !== "production") {
      console.warn("[NeuralCoreBoundary] R3F crash caught:", error.message, info.componentStack);
    }
  }

  render() {
    if (this.state.crashed) {
      return <StaticCore className={this.props.className} />;
    }
    return <NeuralCore className={this.props.className} />;
  }
}
