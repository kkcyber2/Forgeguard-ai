"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  CheckCircle2,
  Circle,
  Loader2,
  ScanFace,
} from "lucide-react";
import { submitFaceLiveness, type FaceLivenessPose } from "./verification-actions";
import { SCHEMA_SYNC_MSG } from "@/lib/verify/messages";
import {
  cameraErrorMessage,
  CameraPermissionOverlay,
  CAMERA_PERMISSION_DENIED_MESSAGE,
  isCameraPermissionDenied,
} from "./camera-permission-overlay";

const POSES: {
  id: FaceLivenessPose;
  label: string;
  hint: string;
  icon: typeof Circle;
}[] = [
  { id: "center", label: "Center", hint: "Look straight at the camera", icon: ScanFace },
  { id: "up", label: "Up", hint: "Tilt your head up slightly", icon: ArrowUp },
  { id: "down", label: "Down", hint: "Tilt your head down slightly", icon: ArrowDown },
  { id: "left", label: "Left", hint: "Turn your head left", icon: ArrowLeft },
  { id: "right", label: "Right", hint: "Turn your head right", icon: ArrowRight },
];

type Phase = "idle" | "requesting" | "live" | "error" | "submitting";

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function frameHash(dataUrl: string): string {
  const base64 = dataUrl.split(",")[1] ?? "";
  let h = 0;
  for (let i = 0; i < Math.min(base64.length, 8000); i += 1) {
    h = (h * 31 + base64.charCodeAt(i)) | 0;
  }
  return String(h);
}

function isValidCapture(dataUrl: string | null): boolean {
  if (!dataUrl?.startsWith("data:image/jpeg;base64,")) return false;
  const base64 = dataUrl.split(",")[1];
  return Boolean(base64 && base64.length > 100);
}

export function FaceLiveness({
  verified,
  poseCount,
}: {
  verified: boolean;
  poseCount: number;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [captures, setCaptures] = useState<Partial<Record<FaceLivenessPose, string>>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [done, setDone] = useState(verified);
  const [pending, startTransition] = useTransition();

  const currentPose = POSES[stepIndex];
  const allCaptured = POSES.every((p) => captures[p.id]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async () => {
    if (streamRef.current || startingRef.current) return;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      alert("SSL REQUIRED FOR BIOMETRICS");
      setErrorMsg("Camera requires HTTPS.");
      setPhase("error");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Camera API unavailable.");
      setPhase("error");
      return;
    }

    stopCamera();
    setPhase("requesting");
    setErrorMsg(null);
    setPermissionDenied(false);
    startingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        setPhase("error");
        return;
      }
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();
      setPhase("live");
    } catch (err) {
      stopCamera();
      setErrorMsg(cameraErrorMessage(err));
      setPermissionDenied(isCameraPermissionDenied(err));
      setPhase("error");
    } finally {
      startingRef.current = false;
    }
  }, [stopCamera]);

  function captureFrame() {
    if (!videoRef.current || !canvasRef.current || !currentPose) return;
    const video = videoRef.current;
    if (video.videoWidth === 0) {
      setErrorMsg("Camera not ready.");
      setPhase("error");
      return;
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    canvasRef.current.width = video.videoWidth;
    canvasRef.current.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.85);
    if (!isValidCapture(dataUrl)) {
      setErrorMsg("Empty frame — try again.");
      return;
    }

    const hash = frameHash(dataUrl);
    const duplicate = Object.entries(captures).some(
      ([id, url]) => id !== currentPose.id && url && frameHash(url) === hash,
    );
    if (duplicate) {
      setErrorMsg("Move your head — this frame matches a previous pose.");
      return;
    }

    setCaptures((prev) => ({ ...prev, [currentPose.id]: dataUrl }));
    if (stepIndex < POSES.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }

  function handleSubmit() {
    const payload = POSES.map((p) => ({
      pose: p.id,
      dataUrl: captures[p.id] ?? "",
    })).filter((x) => isValidCapture(x.dataUrl));

    if (payload.length < POSES.length) {
      setErrorMsg("Complete all poses before submitting.");
      return;
    }

    setPhase("submitting");
    startTransition(async () => {
      const res = await submitFaceLiveness(payload);
      if (res.error) {
        setErrorMsg(res.schemaSync ? SCHEMA_SYNC_MSG : res.error);
        setPhase("live");
        return;
      }
      stopCamera();
      setDone(true);
      setPhase("idle");
      router.refresh();
    });
  }

  if (done || verified) {
    return (
      <div className="flex items-center gap-3">
        <CheckCircle2 size={16} className="text-[#D1FF00]" />
        <div>
          <p className="text-sm font-medium text-white">Face liveness verified</p>
          <p className="text-xs text-white/50">
            {poseCount > 0 ? `${poseCount} pose frames on file.` : "Multi-pose scan sealed."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="clearance-liveness" className="flex flex-col gap-4 scroll-mt-24 overflow-x-hidden">
      <div className="flex items-center gap-2">
        <ScanFace size={14} className="text-[#D1FF00]" />
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#D1FF00] sm:text-sm">
          Hacker liveness
        </p>
      </div>

      <p className="text-xs leading-relaxed text-white/50 sm:text-sm">
        Required for Tactical clearance. Follow the guided poses — center, up, down, left, right.
        {isMobileDevice() ? " Front camera (selfie) is used on mobile." : ""}
      </p>

      <ol className="flex flex-wrap gap-2">
        {POSES.map((p, i) => {
          const Icon = p.icon;
          const captured = Boolean(captures[p.id]);
          const active = i === stepIndex;
          return (
            <li
              key={p.id}
              className={`flex items-center gap-1.5 rounded-[3px] border px-2 py-1.5 font-mono text-xs uppercase tracking-wider sm:text-[11px] ${
                captured
                  ? "border-[#D1FF00]/40 text-[#D1FF00]"
                  : active
                    ? "border-violet-400/50 text-violet-300"
                    : "border-white/10 text-white/35"
              }`}
            >
              <Icon size={10} />
              {p.label}
            </li>
          );
        })}
      </ol>

      {currentPose && phase !== "idle" && (
        <p className="font-mono text-xs text-violet-300/90 sm:text-sm">
          Step {stepIndex + 1}/{POSES.length}: {currentPose.hint}
        </p>
      )}

      <div
        className="relative w-full min-h-[240px] overflow-hidden rounded-[4px] sm:max-h-[320px]"
        style={{
          aspectRatio: "3/4",
          background: "rgba(0,0,0,0.5)",
          border: "0.5px solid rgba(209,255,0,0.2)",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ display: phase === "live" || phase === "requesting" ? "block" : "none" }}
        />
        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Camera size={20} className="text-[#D1FF00]/70" />
            <p className="text-xs text-white/40">Camera off</p>
          </div>
        )}
        {phase === "error" &&
          (errorMsg === CAMERA_PERMISSION_DENIED_MESSAGE ? (
            <CameraPermissionOverlay />
          ) : (
            <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-red-400">
              {errorMsg}
            </p>
          ))}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {errorMsg && phase !== "error" && (
        <p className="text-xs text-amber-400/90">{errorMsg}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {phase === "idle" || phase === "error" ? (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-2 rounded-[3px] bg-[#D1FF00]/15 py-3 font-mono text-sm font-semibold uppercase tracking-[0.12em] text-[#D1FF00] sm:text-xs"
          >
            <Camera size={12} />
            Start liveness scan
          </button>
        ) : phase === "live" ? (
          <>
            <button
              type="button"
              onClick={captureFrame}
              disabled={Boolean(captures[currentPose?.id ?? "center"])}
              className="flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-2 rounded-[3px] bg-violet-500 py-3 font-mono text-sm font-semibold uppercase text-white disabled:opacity-40 sm:text-xs"
            >
              Capture {currentPose?.label}
            </button>
            {allCaptured && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-2 rounded-[3px] bg-[#D1FF00]/15 py-3 font-mono text-sm font-semibold uppercase text-[#D1FF00] sm:text-xs"
              >
                {pending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Submit liveness
              </button>
            )}
          </>
        ) : phase === "submitting" || pending ? (
          <div className="flex items-center justify-center gap-2 py-2 font-mono text-[10px] text-white/50">
            <Loader2 size={12} className="animate-spin" />
            Sealing poses…
          </div>
        ) : null}
      </div>
    </div>
  );
}
