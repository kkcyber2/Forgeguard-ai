"use client";

import { useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileSearch, Loader2, Upload } from "lucide-react";
import { uploadIdentityDocument } from "./verification-actions";
import { useSovereignStore } from "@/stores/use-sovereign-store";

export function IdentityAuditor({
  documentPath,
  auditStatus,
  auditScore,
}: {
  documentPath: string | null;
  auditStatus: string;
  auditScore: number | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captureMode, setCaptureMode] = useState<"upload" | "webcam">("upload");
  const [camState, setCamState] = useState<"idle" | "live" | "error">("idle");
  const [camError, setCamError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<{
    score: number;
    passed: boolean;
    mode: string;
    notes: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startWebcam = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("Camera unavailable in this browser.");
      setCamState("error");
      return;
    }
    setCamError(null);
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
    } catch {
      setCamError("Camera access denied or unavailable.");
      setCamState("error");
    }
  }, []);

  function captureWebcamFrame(): File | null {
    if (!videoRef.current || !canvasRef.current) return null;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return null;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.9);
    stopCamera();
    setCamState("idle");
    const bin = atob(dataUrl.split(",")[1] ?? "");
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], "webcam-id.jpg", { type: "image/jpeg" });
  }

  async function extractText(file: File): Promise<string> {
    if (file.type.startsWith("image/")) {
      return `[IMAGE_UPLOAD] filename=${file.name} type=${file.type} size=${file.size}. OCR text not available — auditor uses filename metadata and profile name correlation.`;
    }
    if (file.type === "application/pdf") {
      return `[PDF_UPLOAD] filename=${file.name} size=${file.size}. PDF binary submitted for sovereign review pipeline.`;
    }
    return await file.text().catch(() => `[BINARY] ${file.name}`);
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
      const formData = new FormData();
      formData.append("document", file);

      const up = await uploadIdentityDocument(formData);
      if (up.error) {
        setError(up.error);
        return;
      }

      const text = await extractText(file);
      const res = await fetch("/api/verify/ai-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_text: text,
          document_path: up.path,
        }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        result?: { confidence_score: number; audit_notes: string; mode: string };
        passed?: boolean;
        status?: string;
      };

      if (!json.ok) {
        setError(json.error ?? "AI audit failed.");
        return;
      }

      setAuditResult({
        score: json.result?.confidence_score ?? 0,
        passed: !!json.passed,
        mode: json.result?.mode ?? "unknown",
        notes: json.result?.audit_notes ?? "",
      });
      if (json.passed) router.refresh();
    });
  }

  return (
    <div id="clearance-audit" className="relative flex flex-col gap-4 scroll-mt-24">
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
        Upload government ID or capture via webcam. DeepSeek-R1 extracts your legal
        name and cross-checks profile data.
      </p>

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
            className="flex flex-1 items-center justify-center gap-2 rounded-[3px] border py-2 font-mono text-[10px] uppercase tracking-widest"
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
            {camState !== "live" && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white/40">
                {camError ?? "Rear camera preferred on mobile for ID capture"}
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {camState !== "live" ? (
              <button
                type="button"
                onClick={startWebcam}
                className="flex-1 rounded-[3px] bg-violet-500/90 py-2 font-mono text-[10px] uppercase tracking-widest text-white"
              >
                Start camera
              </button>
            ) : (
              <button
                type="button"
                onClick={() => captureWebcamFrame()}
                className="flex-1 rounded-[3px] bg-[#D1FF00]/15 py-2 font-mono text-[10px] uppercase tracking-widest text-[#D1FF00]"
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
          className="sr-only"
        />
      </label>
      )}

      {documentPath && (
        <p className="font-mono text-[9px] text-zinc-500 truncate">
          On file: {documentPath}
        </p>
      )}

      <button
        type="button"
        onClick={handleUploadAndAudit}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-[3px] border-[0.5px] border-[#D1FF00]/35 bg-[#D1FF00]/10 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#D1FF00] disabled:opacity-40"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <FileSearch size={12} />}
        Run AI audit
      </button>

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
        </div>
      )}

      {error && <p className="font-mono text-[10px] text-red-400/90">{error}</p>}
    </div>
  );
}
