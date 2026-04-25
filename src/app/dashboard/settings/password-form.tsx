"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { passwordStrength } from "@/lib/utils";
import { updatePassword, type SettingsState } from "./actions";

const initial: SettingsState = { ok: false };

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initial);
  const [pw, setPw] = React.useState("");
  const meter = passwordStrength(pw);

  // Reset the strength meter once a save lands so the form is "clean".
  React.useEffect(() => {
    if (state.ok) setPw("");
  }, [state.ok]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="current_password">Current password</Label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={!!state.fieldErrors?.current_password}
        />
        <FieldError>{state.fieldErrors?.current_password}</FieldError>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="new_password">New password</Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            aria-invalid={!!state.fieldErrors?.new_password}
          />
          <FieldError>{state.fieldErrors?.new_password}</FieldError>
          {pw.length > 0 ? (
            <div className="mt-2">
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className={
                    meter.score >= 3
                      ? "h-full bg-acid"
                      : meter.score === 2
                      ? "h-full bg-amber-400"
                      : "h-full bg-threat"
                  }
                  style={{ width: `${(meter.score / 4) * 100}%` }}
                />
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                Strength · {meter.label}
              </p>
            </div>
          ) : null}
        </div>

        <div>
          <Label htmlFor="confirm_password">Confirm new password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            aria-invalid={!!state.fieldErrors?.confirm_password}
          />
          <FieldError>{state.fieldErrors?.confirm_password}</FieldError>
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-sm border-hairline border-threat/40 bg-threat-wash px-3 py-2 text-xs text-threat"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        {state.ok && state.message ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-acid">
            <CheckCircle2 size={12} strokeWidth={1.75} />
            {state.message}
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          <KeyRound size={12} strokeWidth={1.75} />
          {pending ? "Rotating…" : "Rotate password"}
        </Button>
      </div>
    </form>
  );
}
