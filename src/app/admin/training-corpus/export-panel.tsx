"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { runTrainingCorpusExport } from "./actions";

export function TrainingCorpusExportPanel({
  lastExportPath,
}: {
  lastExportPath: string | null;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);
  const [rowCount, setRowCount] = React.useState<number | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    const result = await runTrainingCorpusExport();
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDownloadUrl(result.downloadUrl);
    setRowCount(result.rowCount);
    window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-xl border border-lime-500/20 bg-lime-500/5 p-6">
      <h2 className="font-display text-lg text-lime-400">JSONL export</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Exports redacted, opt-in corpus events to private storage. Secrets are masked via
        redact-secrets patterns before insert.
      </p>

      {lastExportPath && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Last export: {lastExportPath}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {rowCount != null && downloadUrl && (
        <p className="mt-3 text-sm text-lime-300">
          Exported {rowCount} rows —{" "}
          <a href={downloadUrl} className="underline" target="_blank" rel="noreferrer">
            download
          </a>
        </p>
      )}

      <button
        type="button"
        className={buttonStyles({ className: "mt-4" })}
        disabled={loading}
        onClick={() => void handleExport()}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Generate JSONL export
      </button>
    </div>
  );
}
