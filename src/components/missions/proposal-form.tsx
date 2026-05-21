"use client";

/**
 * ProposalForm — Hacker submits a mission proposal
 * ─────────────────────────────────────────────────
 * Minimal glassmorphic form matching Sovereign OS aesthetic.
 */

import { useState, useTransition } from "react";
import { Send, Loader2 } from "lucide-react";
import { submitProposal } from "./actions";

interface Props {
  missionId: string;
}

export function ProposalForm({ missionId }: Props) {
  const [pitch, setPitch] = useState("");
  const [timeline, setTimeline] = useState("");
  const [askCredits, setAskCredits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pitch.trim()) {
      setError("Pitch is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitProposal({
        missionId,
        pitch: pitch.trim(),
        timeline: timeline.trim() || null,
        askCredits: askCredits ? parseInt(askCredits, 10) : 0,
      });
      if (res.error) setError(res.error);
      else setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div
        className="rounded-[4px] p-5 text-center"
        style={{
          background: "rgba(209,255,0,0.05)",
          border: "0.5px solid rgba(209,255,0,0.25)",
        }}
      >
        <p className="font-mono text-xs uppercase tracking-[0.15em]" style={{ color: "#D1FF00" }}>
          Proposal Submitted
        </p>
        <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          The client will review your pitch and respond.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-[4px] p-5"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
        border: "0.5px solid rgba(255,255,255,0.09)",
      }}
    >
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: "#D1FF00" }}>
        Submit Proposal
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Pitch */}
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
            Your Pitch
          </label>
          <textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder="Describe your approach, your tools, and why you're the right operator for this mission..."
            rows={4}
            className="rounded-[3px] px-3 py-2 text-xs leading-relaxed resize-none outline-none transition-colors"
            style={{
              background: "rgba(0,0,0,0.35)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.75)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(209,255,0,0.35)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
        </div>

        {/* Timeline + Credits row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
              Timeline
            </label>
            <input
              type="text"
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              placeholder="e.g. 2–3 days"
              className="rounded-[3px] px-3 py-2 text-xs outline-none transition-colors"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.75)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(209,255,0,0.35)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
              Ask (credits)
            </label>
            <input
              type="number"
              min={0}
              value={askCredits}
              onChange={(e) => setAskCredits(e.target.value)}
              placeholder="0"
              className="rounded-[3px] px-3 py-2 text-xs outline-none transition-colors"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.75)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(209,255,0,0.35)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
          </div>
        </div>

        {error && (
          <p className="text-xs" style={{ color: "rgba(255,100,100,0.85)" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center gap-2 rounded-[3px] py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] transition-all duration-150 disabled:opacity-50"
          style={{
            background: "#D1FF00",
            color: "#050505",
          }}
        >
          {isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Send size={13} strokeWidth={1.75} />
          )}
          {isPending ? "Submitting…" : "Submit Proposal"}
        </button>
      </form>
    </div>
  );
}
