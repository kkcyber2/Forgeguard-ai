"use client";

import { useRef, useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileSearch, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadIdentityDocument } from "./verification-actions";
import { runAiAudit } from "./identity-actions";
import { useClearanceUpload } from "./settings-clearance-aside";
import { SCHEMA_SYNC_MSG } from "@/lib/verify/messages";
import { useSovereignStore } from "@/stores/use-sovereign-store";
import {
  cameraErrorMessage,
  CameraPermissionOverlay,
  CAMERA_PERMISSION_DENIED_MESSAGE,
} from "./camera-permission-overlay";

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

async function compressImageFile(
  file: File,
  maxWidth = 1280,
  quality = 0.72,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 400_000) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(
            new File(
              [blob],
              file.name.replace(/\.\w+$/i, "") + ".jpg",
              { type: "image/jpeg" },
            ),
          );
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export function IdentityAuditor({
  documentPath,
  auditStatus,
  auditScore,
  profileFullName,
}: {
  documentPath: string | null;
  auditStatus: string;
  auditScore: number | null;
  profileFullName?: string;
}) {
  const router = useRouter();
  const { markDocumentUploaded } = useClearanceUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [captureMode, setCaptureMode] = useState<"upload" | "webcam">("upload");
  const [camState, setCamState] = useState<"idle" | "live" | "error" | "requesting">("idle");
  const [camError, setCamError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    score: number;
    passed: boolean;
    mode: string;
    notes: string;
    failureReason?: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);
  const busy = pending || auditing;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [stopCamera]);

  function showSyncToast(message: string) {
    setSyncToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSyncToast(null), 8000);
  }

  const startWebcam = useCallback(async () => {
    if (videoRef.current?.srcObject || streamRef.current) return;
    if (startingRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("Camera unavailable in this browser.");
      setCamState("error");
      return;
    }
    setCamError(null);
    setCamState("requesting");
    startingRef.current = true;

    try {
      const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mobile ? { ideal: "environment" } : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamState("live");
    } catch (err) {
      if (
        isAbortError(err) &&
        (videoRef.current?.srcObject || streamRef.current)
      ) {
        console.warn("[verify:auditor] getUserMedia aborted — stream already active");
        setCamState("live");
        return;
      }
      console.error("[verify:auditor] getUserMedia failed:", err);
      setCamError(cameraErrorMessage(err));
      setCamState("error");
    } finally {
      startingRef.current = false;
    }
  }, []);

  function captureWebcamFrame(): File | null {
    if (!videoRef.current || !canvasRef.current) return null;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return null;

    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    const maxW = 1280;
    const scale = vw > maxW ? maxW / vw : 1;
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);

    canvasRef.current.width = w;
    canvasRef.current.height = h;
    ctx.drawImage(videoRef.current, 0, 0, w, h);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.72);
    stopCamera();
    setCamState("idle");
    const bin = atob(dataUrl.split(",")[1] ?? "");
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], "webcam-id.jpg", { type: "image/jpeg" });
  }

  async function handleAudit(uploadedPath: string) {
    setError(null);
    setAuditResult(null);
    setAuditing(true);

    try {
      const audit = await runAiAudit(uploadedPath);

      if (audit.error || !audit.ok) {
        const reason =
          audit.failure_reason ?? audit.error ?? "AI audit failed.";
        setError(reason);
        return;
      }

      const passed = !!audit.passed;
      const extractedName = audit.result?.extracted_name ?? "";
      const profileName = audit.profile_full_name ?? profileFullName ?? "";

      if (!passed && (extractedName || profileName)) {
        console.warn("[verify:auditor] Identity name comparison:", {
          extractedName: extractedName || "(none)",
          profileName: profileName || "(none)",
          nameMatch: audit.result?.name_match,
          score: audit.result?.confidence_score,
          failureReason: audit.failure_reason,
        });
      }

      setAuditResult({
        score: audit.result?.confidence_score ?? 0,
        passed,
        mode: audit.result?.mode ?? "unknown",
        notes: audit.result?.audit_notes ?? "",
        failureReason: passed ? undefined : audit.failure_reason,
      });

      if (!passed && audit.failure_reason) {
        setError(audit.failure_reason);
      }

      router.refresh();
    } catch (err) {
      console.error("[verify:auditor] runAiAudit:", err);
      setError(err instanceof Error ? err.message : "AI audit failed unexpectedly.");
    } finally {
      setAuditing(false);
    }
  }

  function handleUploadAndAudit() {
    let file = inputRef.current?.files?.[0] ?? null;
    if (captureMode === "webcam" && camState === "live") {
      file = captureWebcamFrame();
    }
    if (!file) {
      setError(
        captureMode === "webcam"
          ? "Start the camera and capture your ID first."
          : "Select identity documentation first.",
      );
      return;
    }

    setError(null);
    startTransition(async () => {
      const compressed = await compressImageFile(file!);
      const formData = new FormData();
      formData.append("document", compressed);

      const up = await uploadIdentityDocument(formData);
      if (up.error) {
        if (up.schemaSync) {
          showSyncToast(SCHEMA_SYNC_MSG);
        }
        setError(up.error);
        return;
      }

      if (!up.path) {
        setError("Upload succeeded but document path missing.");
        return;
      }

      markDocumentUploaded();
      router.refresh();

      await handleAudit(up.path);
    });
  }

  return (
    <div
      id="clearance-audit"
      className="relative flex flex-col gap-4 scroll-mt-24"
    >
      {isGhostMode && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[4px]"
          style={{
            backdropFilter: "blur(0.2px)",
            background: "rgba(5,5,5,0.55)",
            border: "0.5px solid rgba(74,74,74,0.35)",
          }}
        >
          <p
            className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#4A4A4A]"
            style={{ textShadow: "0 0 12px rgba(74,74,74,0.45)" }}
          >
            Ghost Encrypted
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <FileSearch size={12} className="text-[#D1FF00]/80" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Identity auditor
        </p>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-zinc-500">
          {auditStatus}
        </span>
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-white/55">
        Upload government ID or capture via webcam. Deep Perception reads your
        document from secure storage, then DeepSeek-R1 cross-checks your profile name.
      </p>

      {syncToast && (
        <div className="rounded-[3px] border border-amber-400/40 bg-amber-400/10 px-3 py-2 font-mono text-[10px] text-amber-200">
          {syncToast}
        </div>
      )}

      {auditing && (
        <div className="flex items-center gap-2 rounded-[3px] border border-violet-400/30 bg-violet-500/10 px-3 py-2 font-mono text-[10px] text-violet-200">
          <Loader2 size={12} className="shrink-0 animate-spin" />
          Processing… AI is analyzing your ID — do not close this tab or camera.
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {(["upload", "webcam"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              setCaptureMode(mode);
              if (mode === "upload") {
                stopCamera();
                setCamState("idle");
              }
            }}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-[3px] border py-2 font-mono text-[10px] uppercase tracking-widest disabled:opacity-40"
            style={{
              borderColor: captureMode === mode ? "rgba(209,255,0,0.35)" : "rgba(255,255,255,0.1)",
              color: captureMode === mode ? "#D1FF00" : "rgba(255,255,255,0.45)",
              background: captureMode === mode ? "rgba(209,255,0,0.06)" : "transparent",
            }}
          >
            {mode === "webcam" ? <Camera size={12} /> : <Upload size={12} />}
            {mode === "webcam" ? "Webcam ID" : "File upload"}
          </button>
        ))}
      </div>

      {captureMode === "webcam" && (
        <div className="space-y-2">
          <div
            className="relative overflow-hidden rounded-[4px] border border-violet-400/20 bg-black/40"
            style={{ aspectRatio: "16/10", maxHeight: 220 }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
              style={{ display: camState === "live" ? "block" : "none" }}
            />
            {camState === "error" && camError === CAMERA_PERMISSION_DENIED_MESSAGE ? (
              <CameraPermissionOverlay compact />
            ) : camState !== "live" ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white/40">
                {camError ?? "Rear camera preferred on mobile for ID capture"}
              </div>
            ) : null}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {camState !== "live" ? (
              <button
                type="button"
                onClick={() => void startWebcam()}
                disabled={camState === "requesting" || busy}
                className="flex-1 rounded-[3px] bg-violet-500/90 py-2 font-mono text-[10px] uppercase tracking-widest text-white disabled:opacity-40"
              >
                Start camera
              </button>
            ) : (
              <button
                type="button"
                onClick={() => captureWebcamFrame()}
                disabled={busy}
                className="flex-1 rounded-[3px] bg-[#D1FF00]/15 py-2 font-mono text-[10px] uppercase tracking-widest text-[#D1FF00] disabled:opacity-40"
              >
                Capture frame
              </button>
            )}
          </div>
        </div>
      )}

      {captureMode === "upload" && (
      <label
        className="flex cursor-pointer flex-col items-center gap-2 rounded-[4px] border border-dashed border-white/15 bg-black/30 px-6 py-8 transition-colors hover:border-[#D1FF00]/30 hover:bg-[#D1FF00]/[0.03]"
      >
        <Upload size={16} className="text-zinc-500" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
          Secure upload — PDF, PNG, JPEG
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          autoComplete="off"
          className="sr-only"
        />
      </label>
      )}

      {documentPath && (
        <p className="font-mono text-[9px] text-zinc-500 truncate">
          On file: {documentPath}
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        disabled={busy || camState === "requesting"}
        onClick={(e) => {
          e.preventDefault();
          handleUploadAndAudit();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-[3px] border-[0.5px] border-[#D1FF00]/35 bg-[#D1FF00]/10 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#D1FF00] hover:bg-[#D1FF00]/15 disabled:opacity-40"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <FileSearch size={12} />}
        Run AI audit
      </Button>

      {auditScore != null && !auditResult && (
        <p className="font-mono text-[10px] text-zinc-400">
          Last score: <span className="text-[#D1FF00]">{auditScore}</span>/100
        </p>
      )}

      {auditResult && (
        <div
          className="rounded-[3px] border-[0.5px] px-3 py-2 font-mono text-[10px]"
          style={{
            borderColor: auditResult.passed
              ? "rgba(209,255,0,0.3)"
              : "rgba(255,255,255,0.1)",
            color: auditResult.passed ? "#D1FF00" : "rgba(255,255,255,0.6)",
          }}
        >
          <p>
            {auditResult.mode} · {auditResult.score}/100 ·{" "}
            {auditResult.passed ? "MATCH" : "REVIEW"}
          </p>
          <p className="mt-1 text-zinc-500">{auditResult.notes}</p>
          {auditResult.failureReason && (
            <p className="mt-1 text-red-400/90">{auditResult.failureReason}</p>
          )}
        </div>
      )}

      {error && !auditResult?.failureReason && (
        <p className="font-mono text-[10px] text-red-400/90">{error}</p>
      )}
      {error && auditResult?.failureReason && error !== auditResult.failureReason && (
        <p className="font-mono text-[10px] text-red-400/90">{error}</p>
      )}
    </div>
  );
}
