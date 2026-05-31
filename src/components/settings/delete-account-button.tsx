"use client";

import * as React from "react";
import { requestAccountDeletion } from "@/app/dashboard/settings/account-actions";

type Props = {
  deletionRequestedAt: string | null;
};

export function DeleteAccountButton({ deletionRequestedAt }: Props) {
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (deletionRequestedAt) {
    return (
      <p className="mt-3 font-mono text-[11px] text-foreground-muted">
        Deletion requested{" "}
        {new Date(deletionRequestedAt).toLocaleDateString()}. Processing within 30 days.
      </p>
    );
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const result = await requestAccountDeletion();
      if (result?.error) setError(result.error);
    } catch {
      // redirect throws
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 border-t border-white/[0.06] pt-5">
      <p className="text-eyebrow text-foreground-subtle">Danger zone</p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 w-full rounded-sm border-2 border-red-500/60 bg-red-500/5 py-2 font-mono text-xs uppercase tracking-[0.14em] text-red-400 transition-colors hover:bg-red-500/10"
        >
          Delete account
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="font-mono text-[11px] text-foreground-muted">
            This schedules account deletion within 30 days and signs you out immediately.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void handleDelete()}
              className="flex-1 rounded-sm border-2 border-red-500/60 bg-red-500/15 py-2 font-mono text-xs uppercase tracking-[0.14em] text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            >
              {pending ? "Processing…" : "Confirm delete"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-sm border-hairline px-3 py-2 font-mono text-xs text-foreground-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className="mt-2 font-mono text-[11px] text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
