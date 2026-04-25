"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowUpRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { login, type AuthActionState } from "../actions";

const initial: AuthActionState = { ok: false };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <div className="relative rounded-sm border-hairline border-white/[0.08] bg-surface/80 backdrop-blur-md shadow-elevated">
      <div className="border-b-[0.5px] border-white/[0.06] px-6 py-5">
        <p className="text-eyebrow text-acid">Access channel</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Sign in to your command center
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Use the email you onboarded with. Single sign-on coming soon.
        </p>
      </div>

      <form action={formAction} className="px-6 py-6 space-y-5" noValidate>
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
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/auth/reset-password"
              className="text-[11px] text-foreground-muted hover:text-acid transition-colors"
            >
              Reset
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={1}
            aria-invalid={!!state.fieldErrors?.password}
          />
          <FieldError>{state.fieldErrors?.password}</FieldError>
        </div>

        {state.error && !state.ok ? (
          <div
            role="alert"
            className="rounded-sm border-hairline border-threat/40 bg-threat-wash px-3 py-2 text-xs text-threat"
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
          <Lock size={14} strokeWidth={1.75} />
          {pending ? "Authenticating…" : "Sign in"}
        </Button>
      </form>

      <div className="border-t-[0.5px] border-white/[0.06] px-6 py-4 flex items-center justify-between text-xs text-foreground-muted">
        <span>No account?</span>
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-1 text-foreground hover:text-acid transition-colors"
        >
          Request access <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
