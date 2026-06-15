"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSearch, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadIdentityDocument } from "./verification-actions";
import { runAiAudit } from "./identity-actions";
import { useClearanceUpload } from "./settings-clearance-aside";
import { SCHEMA_SYNC_MSG } from "@/lib/verify/messages";
import { useSovereignStore } from "@/stores/use-sovereign-store";
import { formatIdentityFailureTruth } from "@/lib/verify/identity-failure-display";

const ACCEPT =
  "application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp";
const MAX_BYTES = 8 * 1024 * 1024;
const EXT_RE = /\.(pdf|png|jpe?g|webp)$/i;

type UploadPhase =
  | "idle"
  | "file_selected"
  | "uploading"
  | "auditing"
  | "success"
  | "error";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function validateClientFile(file: File): string | null {
  if (file.size === 0) return "File is empty.";
  if (file.size > MAX_BYTES) return "Max file size is 8 MB.";
  const typeOk =
    /^(application\/pdf|image\/(png|jpe?g|webp))$/i.test(file.type) ||
    EXT_RE.test(file.name);
  if (!typeOk) return "Use PDF, PNG, JPEG, or WebP only.";
  return null;
}

export function IdentityAuditor({
  documentPath,
  auditStatus,
  auditScore,
  profileFullName,
  initialFailureReason = null,
  sovereignBypass = false,
}: {
  documentPath: string | null;
  auditStatus: string;
  auditScore: number | null;
  profileFullName?: string;
  initialFailureReason?: string | null;
  sovereignBypass?: boolean;
}) {
  const router = useRouter();
  const { markDocumentUploaded } = useClearanceUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [uploadedPath, setUploadedPath] = useState<string | null>(documentPath);
  const [error, setError] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<{
    score: number;
    passed: boolean;
    mode: string;
    notes: string;
    failureReason?: string;
  } | null>(null);
  const [liveFailureReason, setLiveFailureReason] = useState<string | null>(
    initialFailureReason,
  );
  const [pending, startTransition] = useTransition();
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);

  const busy = pending || phase === "uploading" || phase === "auditing";

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [previewUrl]);

  useEffect(() => {
    setUploadedPath(documentPath);
  }, [documentPath]);

  useEffect(() => {
    if (!sovereignBypass) return;
    setAuditResult({
      score: 100,
      passed: true,
      mode: "sovereign_pulse",
      notes: "VERIFIED: SOVEREIGN",
    });
    setPhase("success");
  }, [sovereignBypass]);

  const statusNorm = auditStatus.toLowerCase();
  const displayFailureReason =
    liveFailureReason ??
    auditResult?.failureReason ??
    initialFailureReason;
  const truthReason = displayFailureReason
    ? formatIdentityFailureTruth(displayFailureReason)
    : null;
  const sovereignVerified =
    sovereignBypass ||
    statusNorm === "passed" ||
    auditResult?.passed ||
    auditResult?.notes === "VERIFIED: SOVEREIGN";
  const statusLabel = sovereignVerified
    ? "VERIFIED: SOVEREIGN"
    : statusNorm === "failed"
      ? "FAILED"
      : statusNorm === "review"
        ? "REVIEW_REQUIRED"
        : auditStatus;
  const showFailureTruth =
    !!truthReason?.trim() &&
    (statusNorm === "failed" ||
      statusNorm === "review" ||
      !!liveFailureReason?.trim());

  function showSyncToast(message: string) {
    setSyncToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSyncToast(null), 8000);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    setAuditResult(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (!file) {
      setSelectedFile(null);
      setPhase("idle");
      return;
    }
    const validationError = validateClientFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      setPhase("error");
      return;
    }
    setSelectedFile(file);
    setPhase("file_selected");
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  async function handleAudit(uploadedPathLocal: string) {
    setError(null);
    setAuditResult(null);
    setPhase("auditing");

    try {
      const audit = await runAiAudit(uploadedPathLocal);

      if (audit.error || !audit.ok) {
        const reason =
          audit.error === "ENGINE_COMM_FAIL"
            ? (audit.identity_failure_reason ??
              "Engine unreachable — verify INTERNAL_SCAN_TOKEN matches Railway.")
            : (audit.identity_failure_reason ??
              audit.failure_reason ??
              audit.error ??
              "AI audit failed.");
        setLiveFailureReason(reason);
        setError(reason);
        setPhase("error");
        return;
      }

      const passed = !!audit.passed;
      const persistedReason =
        audit.identity_failure_reason ?? audit.failure_reason ?? null;
      setLiveFailureReason(passed ? null : persistedReason);

      setAuditResult({
        score: audit.result?.confidence_score ?? 0,
        passed,
        mode: audit.result?.mode ?? "unknown",
        notes: audit.result?.audit_notes ?? "",
        failureReason: passed ? undefined : audit.failure_reason,
      });
      setPhase(passed ? "success" : "error");
      router.refresh();
    } catch (err) {
      console.error("[verify:auditor] runAiAudit:", err);
      setError(err instanceof Error ? err.message : "AI audit failed unexpectedly.");
      setPhase("error");
    }
  }

  function handleUploadAndAudit() {
    if (!selectedFile) {
      setError("Select a government ID file first.");
      setPhase("error");
      return;
    }

    setError(null);
    setPhase("uploading");
    startTransition(async () => {
      const formData = new FormData();
      formData.append("document", selectedFile);

      const up = await uploadIdentityDocument(formData);
      if (up.error) {
        if (up.schemaSync) showSyncToast(SCHEMA_SYNC_MSG);
        setError(up.error);
        setPhase("error");
        return;
      }

      if (!up.path) {
        setError("Upload succeeded but document path missing.");
        setPhase("error");
        return;
      }

      setUploadedPath(up.path);
      markDocumentUploaded();
      router.refresh();
      await handleAudit(up.path);
    });
  }

  const receivedLabel = selectedFile
    ? `Received: ${selectedFile.name} (${formatBytes(selectedFile.size)})`
    : null;

  return (
    <div
      id="clearance-audit"
      className="relative flex flex-col gap-4 scroll-mt-24 pb-[env(safe-area-inset-bottom,0px)]"
    >
      {isGhostMode && !sovereignBypass && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[4px]"
          style={{
            backdropFilter: "blur(0.2px)",
            background: "rgba(5,5,5,0.55)",
            border: "0.5px solid rgba(74,74,74,0.35)",
          }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#4A4A4A]">
            Ghost Encrypted
          </p>
        </div>
      )}

      <div className="flex items-start gap-2">
        <FileSearch size={14} className="mt-0.5 shrink-0 text-[#D1FF00]/80" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/50 sm:text-sm">
            Government ID upload
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/55 sm:text-sm">
            Upload passport, driver license, or national ID for sovereign clearance AI audit.
            Face liveness is handled separately above.
          </p>
        </div>
        <span
          className={
            sovereignVerified || statusNorm === "passed"
              ? "shrink-0 font-mono text-xs uppercase tracking-widest text-[#D1FF00]"
              : statusNorm === "failed"
                ? "shrink-0 font-mono text-xs uppercase tracking-widest text-red-400/80"
                : "shrink-0 font-mono text-xs uppercase tracking-widest text-zinc-500"
          }
        >
          {statusLabel}
        </span>
      </div>

      {syncToast && (
        <div className="rounded-[3px] border border-amber-400/40 bg-amber-400/10 px-3 py-2 font-mono text-xs text-amber-200">
          {syncToast}
        </div>
      )}

      {(phase === "uploading" || phase === "auditing") && (
        <div className="flex items-center gap-2 rounded-[3px] border border-violet-400/30 bg-violet-500/10 px-3 py-2.5 font-mono text-xs text-violet-200 sm:text-sm">
          <Loader2 size={14} className="shrink-0 animate-spin" />
          {phase === "uploading"
            ? "Uploading document to secure vault…"
            : "AI is analyzing your ID — do not close this tab."}
        </div>
      )}

      {receivedLabel && phase !== "uploading" && phase !== "auditing" && (
        <div className="flex items-center gap-2 rounded-[3px] border border-[#D1FF00]/30 bg-[#D1FF00]/[0.06] px-3 py-2.5">
          <CheckCircle2 size={14} className="shrink-0 text-[#D1FF00]" />
          <p className="font-mono text-xs text-[#D1FF00] sm:text-sm">{receivedLabel}</p>
        </div>
      )}

      <label
        className="flex min-h-[120px] cursor-pointer touch-manipulation flex-col items-center justify-center gap-3 rounded-[4px] border border-dashed border-white/15 bg-black/30 px-6 py-10 transition-colors hover:border-[#D1FF00]/30 hover:bg-[#D1FF00]/[0.03] active:bg-[#D1FF00]/[0.05] sm:min-h-[140px]"
      >
        <Upload size={20} className="text-zinc-500" />
        <span className="text-center font-mono text-xs uppercase tracking-widest text-zinc-400 sm:text-sm">
          Tap to choose file
        </span>
        <span className="text-center text-xs text-zinc-500 sm:text-sm">
          PDF, PNG, JPEG, WebP · max 8 MB
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          autoComplete="off"
          disabled={busy}
          onChange={handleFileChange}
          className="sr-only"
        />
      </label>

      {previewUrl && (
        <div className="overflow-hidden rounded-[4px] border border-white/10 bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="ID preview"
            className="mx-auto max-h-48 w-full object-contain"
          />
        </div>
      )}

      {uploadedPath && (
        <p className="truncate font-mono text-xs text-zinc-500">
          On file: {uploadedPath}
        </p>
      )}

      {sovereignVerified && (
        <p className="font-mono text-xs text-[#D1FF00] sm:text-sm">VERIFIED: SOVEREIGN</p>
      )}

      {showFailureTruth && truthReason && (
        <p className="font-mono text-xs leading-relaxed text-[#D1FF00] sm:text-sm">
          {truthReason}
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        disabled={busy || !selectedFile}
        onClick={(e) => {
          e.preventDefault();
          handleUploadAndAudit();
        }}
        className="flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-[3px] border-[0.5px] border-[#D1FF00]/35 bg-[#D1FF00]/10 py-3 font-mono text-sm uppercase tracking-[0.16em] text-[#D1FF00] hover:bg-[#D1FF00]/15 disabled:opacity-40"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}
        Run AI audit
      </Button>

      {auditScore != null && !auditResult && (
        <p className="font-mono text-xs text-zinc-400 sm:text-sm">
          Last score: <span className="text-[#D1FF00]">{auditScore}</span>/100
        </p>
      )}

      {auditResult && (
        <div
          className="rounded-[3px] border-[0.5px] px-3 py-2 font-mono text-xs sm:text-sm"
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

      {error && !showFailureTruth && (
        <p className="rounded-[3px] border border-red-400/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-300 sm:text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
