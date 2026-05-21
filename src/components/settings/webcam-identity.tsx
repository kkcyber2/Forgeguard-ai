"use client";

/**
 * WebcamIdentity — Identity Proofing stub
 * ─────────────────────────────────────────
 * Requests webcam access to capture an identity photo.
 * The photo is NOT transmitted — this is a UI stub demonstrating
 * the Identity Proofing flow for Enterprise missions.
 * Full biometric verification would integrate a KYC provider.
 * Aesthetic: Sovereign OS — Electric Purple accent.
 */

import { useState, useRef, useCallback } from "react";
import { Camera, Shield, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";

type State = "idle" | "requesting" | "live" | "captured" | "error";

export function WebcamIdentity({ verified }: { verified: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 320 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setState("live");
    } catch {
      setErrorMsg("Camera access denied. Please allow camera in browser settings.");
      setState("error");
    }
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function handleCapture() {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    setCapturedUrl(canvasRef.current.toDataURL("image/jpeg", 0.85));
    stopCamera();
    setState("captured");
  }

  function handleReset() {
    setCapturedUrl(null);
    setState("idle");
    setErrorMsg(null);
  }

  if (verified) {
    return (
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[3px]"
          style={{ background: "rgba(139,92,246,0.1)", border: "0.5px solid rgba(139,92,246,0.3)" }}
        >
          <CheckCircle2 size={16} style={{ color: "#8B5CF6" }} strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Identity Verified</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            Biometric proof on file. Enterprise missions unlocked.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Camera size={13} style={{ color: "#8B5CF6" }} strokeWidth={1.5} />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "#8B5CF6" }}>
          Identity Proofing
        </p>
        <span
          className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-[3px]"
          style={{
            background: "rgba(255,200,0,0.08)",
            border: "0.5px solid rgba(255,200,0,0.25)",
            color: "rgba(255,200,0,0.7)",
          }}
        >
          Beta
        </span>
      </div>

      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
        Required for SOVEREIGN-rank missions. Captures a one-time identity proof using your webcam.{" "}
        <span style={{ color: "rgba(139,92,246,0.7)" }}>No data is transmitted during this preview.</span>
      </p>

      {/* Camera panel */}
      <div
        className="relative overflow-hidden rounded-[4px]"
        style={{
          background: "rgba(0,0,0,0.5)",
          border: "0.5px solid rgba(139,92,246,0.2)",
          aspectRatio: "3/2",
          maxHeight: 260,
        }}
      >
        {/* Live video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ display: state === "live" ? "block" : "none" }}
        />

        {/* Captured frame */}
        {capturedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={capturedUrl}
            alt="Captured identity frame"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Overlay states */}
        {state === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "rgba(139,92,246,0.1)", border: "0.5px solid rgba(139,92,246,0.25)" }}
            >
              <Camera size={20} style={{ color: "#8B5CF6", opacity: 0.7 }} strokeWidth={1.5} />
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Camera not active</p>
          </div>
        )}
        {state === "requesting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] animate-pulse" style={{ color: "#8B5CF6" }}>
              Requesting camera…
            </p>
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertCircle size={18} style={{ color: "rgba(255,100,100,0.7)" }} strokeWidth={1.5} />
            <p className="text-xs" style={{ color: "rgba(255,100,100,0.7)" }}>{errorMsg}</p>
          </div>
        )}

        {/* Scan overlay on live feed */}
        {state === "live" && (
          <>
            {/* Corner brackets */}
            {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos, i) => (
              <div
                key={i}
                className={`absolute ${pos} h-5 w-5`}
                style={{
                  borderTop: i < 2 ? "1.5px solid rgba(139,92,246,0.7)" : "none",
                  borderBottom: i >= 2 ? "1.5px solid rgba(139,92,246,0.7)" : "none",
                  borderLeft: i % 2 === 0 ? "1.5px solid rgba(139,92,246,0.7)" : "none",
                  borderRight: i % 2 === 1 ? "1.5px solid rgba(139,92,246,0.7)" : "none",
                }}
              />
            ))}
            <p
              className="absolute bottom-2 left-0 right-0 text-center font-mono text-[9px] uppercase tracking-[0.15em] animate-pulse"
              style={{ color: "rgba(139,92,246,0.6)" }}
            >
              Scanning…
            </p>
          </>
        )}

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {state === "idle" || state === "error" ? (
          <button
            type="button"
            onClick={startCamera}
            className="flex flex-1 items-center justify-center gap-2 rounded-[3px] py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ background: "#8B5CF6", color: "#fff" }}
          >
            <Camera size={12} strokeWidth={2} />
            Start Camera
          </button>
        ) : state === "live" ? (
          <>
            <button
              type="button"
              onClick={handleCapture}
              className="flex flex-1 items-center justify-center gap-2 rounded-[3px] py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ background: "#8B5CF6", color: "#fff" }}
            >
              <Shield size={12} strokeWidth={2} />
              Capture
            </button>
            <button
              type="button"
              onClick={() => { stopCamera(); setState("idle"); }}
              className="flex items-center gap-1.5 rounded-[3px] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              Cancel
            </button>
          </>
        ) : state === "captured" ? (
          <>
            <div
              className="flex flex-1 items-center gap-2 rounded-[3px] px-3 py-2"
              style={{ background: "rgba(139,92,246,0.08)", border: "0.5px solid rgba(139,92,246,0.2)" }}
            >
              <CheckCircle2 size={12} style={{ color: "#8B5CF6" }} strokeWidth={2} />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "#8B5CF6" }}>
                Frame captured (preview only)
              </span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-[3px] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              <RefreshCw size={11} strokeWidth={1.75} />
              Redo
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
