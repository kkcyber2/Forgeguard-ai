"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Shield,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { saveWebcamCapture } from "./verification-actions";

type State = "idle" | "requesting" | "live" | "captured" | "error" | "saving";

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function cameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") {
      return "Camera access denied. Allow camera permission in browser settings.";
    }
    if (err.name === "NotFoundError") {
      return "No camera found on this device.";
    }
    if (err.name === "NotReadableError") {
      return "Camera is in use by another application.";
    }
  }
  return "Could not access camera. Check permissions and try again.";
}

export function WebcamIdentity({ verified }: { verified: boolean }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(verified);
  const [pending, startTransition] = useTransition();

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Camera API unavailable. Use HTTPS or a modern browser.");
      setState("error");
      return;
    }

    setState("requesting");
    setErrorMsg(null);

    try {
      const mobile = isMobileDevice();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: mobile ? { ideal: "environment" } : "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("live");
    } catch (err) {
      setErrorMsg(cameraErrorMessage(err));
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

  function handleSubmit() {
    if (!capturedUrl) return;
    setState("saving");
    startTransition(async () => {
      const res = await saveWebcamCapture(capturedUrl);
      if (res.error) {
        setErrorMsg(res.error);
        setState("error");
        return;
      }
      setSaved(true);
      setState("captured");
      router.refresh();
    });
  }

  if (saved || verified) {
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
          <p className="text-xs text-white/50">
            Biometric proof on file. Enterprise missions unlocked.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Camera size={13} style={{ color: "#8B5CF6" }} strokeWidth={1.5} />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "#8B5CF6" }}>
          Identity Proofing
        </p>
      </div>

      <p className="text-xs text-white/50">
        Required for SOVEREIGN-rank missions. On mobile, the rear camera is used for ID capture.
      </p>

      <div
        className="relative overflow-hidden rounded-[4px]"
        style={{
          background: "rgba(0,0,0,0.5)",
          border: "0.5px solid rgba(139,92,246,0.2)",
          aspectRatio: "3/2",
          maxHeight: 260,
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ display: state === "live" ? "block" : "none" }}
        />

        {capturedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={capturedUrl}
            alt="Captured identity frame"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {state === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Camera size={20} style={{ color: "#8B5CF6", opacity: 0.7 }} strokeWidth={1.5} />
            <p className="text-xs text-white/40">Camera not active</p>
          </div>
        )}
        {state === "requesting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="animate-pulse font-mono text-[10px] uppercase tracking-[0.15em] text-violet-400">
              Requesting camera…
            </p>
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertCircle size={18} className="text-red-400/80" strokeWidth={1.5} />
            <p className="text-xs text-red-400/90">{errorMsg}</p>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {state === "idle" || state === "error" ? (
          <button
            type="button"
            onClick={startCamera}
            className="flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-violet-500 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
          >
            <Camera size={12} strokeWidth={2} />
            Start Camera
          </button>
        ) : state === "live" ? (
          <>
            <button
              type="button"
              onClick={handleCapture}
              className="flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-violet-500 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              <Shield size={12} strokeWidth={2} />
              Capture ID
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setState("idle");
              }}
              className="rounded-[3px] border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50"
            >
              Cancel
            </button>
          </>
        ) : state === "captured" || state === "saving" ? (
          <>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || state === "saving"}
              className="flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-[#D1FF00]/15 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D1FF00] disabled:opacity-40"
            >
              {pending || state === "saving" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CheckCircle2 size={12} />
              )}
              Seal Identity Proof
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-[3px] border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50"
            >
              <RefreshCw size={11} />
              Redo
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
