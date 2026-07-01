"use client";

/** MFA enrollment stub — Phase 7 TOTP wiring placeholder. */
export function MfaSettingsStub() {
  return (
    <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
      <p className="text-eyebrow text-foreground-subtle">Multi-factor auth</p>
      <p className="mt-2 text-xs text-foreground-muted">
        TOTP enrollment via Supabase Auth MFA — coming in Phase 7. Enable leaked-password
        protection in the Supabase dashboard today.
      </p>
      <button
        type="button"
        disabled
        className="mt-4 cursor-not-allowed rounded-sm border border-white/10 px-4 py-2 text-xs uppercase tracking-wider text-foreground-subtle"
      >
        Enroll authenticator (stub)
      </button>
    </div>
  );
}
