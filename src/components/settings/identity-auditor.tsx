"use client";

import { useRef, useState, useTransition } from "react";
import { FileSearch, Loader2, Upload } from "lucide-react";
import { uploadIdentityDocument } from "./verification-actions";

export function IdentityAuditor({
  documentPath,
  auditStatus,
  auditScore,
}: {
  documentPath: string | null;
  auditStatus: string;
  auditScore: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<{
    score: number;
    passed: boolean;
    mode: string;
    notes: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

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
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Select identity documentation first.");
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
    });
  }

  return (
    <div id="clearance-audit" className="space-y-4 scroll-mt-24">
      <div className="flex items-center gap-2">
        <FileSearch size={12} className="text-[#D1FF00]/80" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Identity auditor
        </p>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-zinc-500">
          {auditStatus}
        </span>
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-zinc-400">
        Upload government ID or corporate authorization letter. DeepSeek-R1 extracts
        your legal name and cross-checks profile data.
      </p>

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
