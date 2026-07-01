"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

export function TrainingCorpusOptOut({
  initialOptOut,
  userId,
}: {
  initialOptOut: boolean;
  userId: string;
}) {
  const [optOut, setOptOut] = React.useState(initialOptOut);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setMessage(null);
    const next = !optOut;
    const supabase = createClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    const { error } = await supabase
      .from("profiles")
      .update({ training_corpus_opt_out: next })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setOptOut(next);
    setMessage(next ? "Opted out of training corpus." : "Opted in to training corpus.");
  }

  return (
    <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
      <p className="text-eyebrow text-foreground-subtle">Training data</p>
      <p className="mt-2 text-xs text-foreground-muted">
        Redacted scan artifacts may be used for future model training unless you opt out.
      </p>
      <button
        type="button"
        disabled={saving}
        onClick={() => void toggle()}
        className="mt-4 rounded-sm border border-white/10 px-4 py-2 text-xs uppercase tracking-wider text-foreground hover:bg-white/[0.04] disabled:opacity-50"
      >
        {optOut ? "Opt in" : "Opt out"}
      </button>
      {message && <p className="mt-2 font-mono text-[10px] text-foreground-subtle">{message}</p>}
    </div>
  );
}
