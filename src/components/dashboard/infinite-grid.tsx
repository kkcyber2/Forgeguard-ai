"use client";

/**
 * InfiniteGrid — Sovereign Dashboard 3D Background
 * ──────────────────────────────────────────────────
 * CSS perspective grid that rotates 45° on the X axis, creating a
 * 3D data-landscape. Subtle mouse parallax tilts the grid ±4°.
 * Pure CSS — zero runtime JS cost when mouse is idle.
 */

import * as React from "react";

export function InfiniteGrid() {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let raf = 0;
    let tx = 0, ty = 0; // current tilt
    let mx = 0, my = 0; // target tilt

    const onMove = (e: MouseEvent) => {
      const { innerWidth: w, innerHeight: h } = window;
      mx = ((e.clientX / w) * 2 - 1) * 4;   // ±4 deg X
      my = ((e.clientY / h) * 2 - 1) * -2;  // ±2 deg Y
    };

    const animate = () => {
      // Lerp toward target
      tx += (mx - tx) * 0.06;
      ty += (my - ty) * 0.06;

      if (gridRef.current) {
        gridRef.current.style.transform =
          `rotateX(${45 + ty}deg) rotateZ(${tx}deg)`;
      }
      raf = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ perspective: "800px", perspectiveOrigin: "50% 40%" }}
    >
      {/* The grid plane */}
      <div
        ref={gridRef}
        style={{
          position: "absolute",
          inset: "-60%",
          transform: "rotateX(45deg)",
          transformStyle: "preserve-3d",
          willChange: "transform",
          backgroundImage: `
            linear-gradient(rgba(209,255,0,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(209,255,0,0.045) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,0,0,0.7) 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,0,0,0.7) 0%, transparent 75%)",
        }}
      />

      {/* Acid-green glow at horizon line */}
      <div
        style={{
          position: "absolute",
          bottom: "35%",
          left: 0,
          right: 0,
          height: "1px",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(209,255,0,0.25) 30%, rgba(209,255,0,0.6) 50%, rgba(209,255,0,0.25) 70%, transparent 100%)",
          boxShadow: "0 0 24px 2px rgba(209,255,0,0.15)",
        }}
      />
    </div>
  );
}
