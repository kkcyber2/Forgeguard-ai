"use client";

/**
 * SignaturePad — Digital Legal Handshake
 * ────────────────────────────────────────
 * Uses react-signature-canvas to capture operator signature.
 * On save: uploads as base64 to Supabase profiles.signature_data.
 * Aesthetic: Sovereign OS — Obsidian / Acid Green.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import { PenLine, RotateCcw, Check, Loader2, ShieldCheck } from "lucide-react";
import { saveSignatureSeal } from "./verification-actions";
import { useSovereignStore } from "@/stores/use-sovereign-store";
import { GhostPublicIdentity } from "@/components/dashboard/ghost-public-identity";

interface Props {
  existingSignature: string | null;
}

export function SignaturePad({ existingSignature }: Props) {
  const router = useRouter();
  const canvasRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [saved, setSaved] = useState(!!existingSignature);
  const [custodyHash, setCustodyHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);

  function handleClear() {
    canvasRef.current?.clear();
    setIsEmpty(true);
    setSaved(false);
    setError(null);
  }

  function handleEnd() {
    setIsEmpty(canvasRef.current?.isEmpty() ?? true);
  }

  function handleSave() {
    if (!canvasRef.current || canvasRef.current.isEmpty()) {
      setError("Please sign before saving.");
      return;
    }
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setError(null);
    startTransition(async () => {
      const res = await saveSignatureSeal(dataUrl);
      if (res.error) setError(res.error);
      else {
        setSaved(true);
        setCustodyHash(res.custodyHash ?? null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <PenLine size={13} style={{ color: "#D1FF00" }} strokeWidth={1.5} />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "#D1FF00" }}>
          Legal Signature
        </p>
        {saved && (
          <span
            className="ml-auto flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-[3px]"
            style={{
              background: "rgba(209,255,0,0.08)",
              border: "0.5px solid rgba(209,255,0,0.3)",
              color: "#D1FF00",
            }}
          >
            <ShieldCheck size={9} strokeWidth={2} />
            On File
          </span>
        )}
      </div>

      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
        This signature authorises ForgeGuard to bind you legally to any mission contracts you accept. Required for Enterprise missions.
      </p>

      {/* Canvas */}
      <div
        className="relative rounded-[4px] overflow-hidden"
        style={{
          border: "0.5px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.5)",
        }}
      >
        <SignatureCanvas
          ref={canvasRef}
          onEnd={handleEnd}
          penColor="#D1FF00"
          backgroundColor="transparent"
          canvasProps={{
            width: 520,
            height: 140,
            style: {
              width: "100%",
              height: 140,
              cursor: "crosshair",
              touchAction: "none",
            },
          }}
        />
        {/* Baseline guide */}
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: 28,
            left: 24,
            right: 24,
            height: "0.5px",
            background: "rgba(255,255,255,0.07)",
          }}
        />
        <p
          className="pointer-events-none absolute bottom-2 right-3 font-mono text-[9px] uppercase tracking-[0.12em]"
          style={{ color: "rgba(255,255,255,0.12)" }}
        >
          Sign above
        </p>
      </div>

      {custodyHash && (
        <p className="font-mono text-[9px] text-zinc-500 break-all">
          Chain of custody: <span className="text-[#D1FF00]/80">{custodyHash.slice(0, 24)}…</span>
        </p>
      )}

      {error && (
        <p className="text-xs" style={{ color: "rgba(255,100,100,0.85)" }}>{error}</p>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <RotateCcw size={11} strokeWidth={1.75} />
          Clear
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || isEmpty}
          className="ml-auto flex items-center gap-1.5 rounded-[3px] px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-all disabled:opacity-40"
          style={{ background: "#D1FF00", color: "#050505" }}
        >
          {isPending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Check size={11} strokeWidth={2.5} />
          )}
          {isPending ? "Saving…" : "Save Signature"}
        </button>
      </div>

      {isGhostMode && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
            Public view (Ghost Protocol active)
          </p>
          <GhostPublicIdentity compact />
        </div>
      )}
    </div>
  );
}
