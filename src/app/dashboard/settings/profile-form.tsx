"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { updateProfile, type SettingsState } from "./actions";

const initial: SettingsState = { ok: false };

export function ProfileForm({
  initial: defaults,
}: {
  initial: { full_name: string; company_name: string; phone: string };
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initial);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          defaultValue={defaults.full_name}
          aria-invalid={!!state.fieldErrors?.full_name}
          placeholder="Alex Reilly"
          autoComplete="name"
        />
        <FieldError>{state.fieldErrors?.full_name}</FieldError>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="company_name">Organisation</Label>
          <Input
            id="company_name"
            name="company_name"
            defaultValue={defaults.company_name}
            aria-invalid={!!state.fieldErrors?.company_name}
            placeholder="Acme Security"
            autoComplete="organization"
          />
          <FieldError>{state.fieldErrors?.company_name}</FieldError>
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaults.phone}
            aria-invalid={!!state.fieldErrors?.phone}
            placeholder="Optional"
            autoComplete="tel"
          />
          <FieldError>{state.fieldErrors?.phone}</FieldError>
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
          <Save size={12} strokeWidth={1.75} />
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
