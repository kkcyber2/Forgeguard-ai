"use client";

/** Team E2EE key exchange stub — Phase 7. */
export function TeamE2eeStub() {
  return (
    <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
      <p className="text-eyebrow text-foreground-subtle">Team E2EE</p>
      <p className="mt-2 text-xs text-foreground-muted">
        End-to-end encrypted mission threads — key exchange stub. No keys are generated yet.
      </p>
      <button
        type="button"
        disabled
        className="mt-4 cursor-not-allowed rounded-sm border border-white/10 px-4 py-2 text-xs uppercase tracking-wider text-foreground-subtle"
      >
        Generate team keypair (stub)
      </button>
    </div>
  );
}
