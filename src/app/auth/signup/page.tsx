"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { signup, type AuthActionState } from "../actions";
import { passwordStrength } from "@/lib/utils";

const initial: AuthActionState = { ok: false };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initial);
  const [pw, setPw] = useState("");
  const strength = passwordStrength(pw);

  return (
    <div className="relative rounded-sm border-hairline border-white/[0.08] bg-surface/80 backdrop-blur-md shadow-elevated">
      <div className="border-b-[0.5px] border-white/[0.06] px-6 py-5">
        <p className="text-eyebrow text-acid">Provision access</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Create a workspace
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          One account per engineer. Share nothing. Your API keys live in the vault.
        </p>
      </div>

      <form action={formAction} className="px-6 py-6 space-y-5" noValidate>
        <div>
          <Label htmlFor="fullName">Name</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            placeholder="Ada Lovelace"
            aria-invalid={!!state.fieldErrors?.fullName}
          />
          <FieldError>{state.fieldErrors?.fullName}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="security@company.com"
            aria-invalid={!!state.fieldErrors?.email}
          />
          <FieldError>{state.fieldErrors?.email}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            aria-invalid={!!state.fieldErrors?.password}
          />
          <StrengthMeter score={strength.score} label={strength.label} empty={!pw} />
          <FieldError>{state.fieldErrors?.password}</FieldError>
        </div>

        {state.error ? (
          <div
            role="alert"
            className={
              state.ok
                ? "rounded-sm border-hairline border-acid/40 bg-acid-wash px-3 py-2 text-xs text-acid"
                : "rounded-sm border-hairline border-threat/40 bg-threat-wash px-3 py-2 text-xs text-threat"
            }
          >
            {state.error}
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={pending}
        >
          <ShieldCheck size={14} strokeWidth={1.75} />
          {pending ? "Provisioning…" : "Create workspace"}
        </Button>
      </form>

      <div className="border-t-[0.5px] border-white/[0.06] px-6 py-4 flex items-center justify-between text-xs text-foreground-muted">
        <span>Already onboarded?</span>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1 text-foreground hover:text-acid transition-colors"
        >
          Sign in <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function StrengthMeter({
  score,
  label,
  empty,
}: {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  empty: boolean;
}) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={
              "h-0.5 flex-1 rounded-full transition-colors " +
              (empty
                ? "bg-white/5"
                : i < score
                ? score >= 3
                  ? "bg-acid"
                  : score === 2
                  ? "bg-amber-400"
                  : "bg-threat"
                : "bg-white/5")
            }
          />
        ))}
      </div>
      {!empty ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          {label}
        </span>
      ) : null}
    </div>
  );
}
