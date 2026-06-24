"use client";

import * as React from "react";
import { Download, Shield } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

export function AegisZipDownload({
  scanId,
  zipB64,
}: {
  scanId: string;
  zipB64: string;
}) {
  const [busy, setBusy] = React.useState(false);

  function handleDownload() {
    setBusy(true);
    try {
      const bytes = Uint8Array.from(atob(zipB64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `forgeguard-aegis-${scanId.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  const sizeKb = Math.round((zipB64.length * 0.75) / 1024);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-acid/25 bg-acid/5 px-4 py-3">
      <div className="flex items-start gap-3">
        <Shield size={16} className="mt-0.5 text-acid" />
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-acid">
            Aegis defense bundle ready
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            One-click export — Cloudflare, FastAPI, and Next.js middleware artifacts ({sizeKb} KB).
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className={buttonStyles({ variant: "primary", size: "sm" })}
      >
        <Download size={14} />
        {busy ? "Preparing…" : "Download .zip"}
      </button>
    </div>
  );
}
