"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail } from "@/lib/utils";
import { ArrowUpRight, Mail } from "lucide-react";

export default function ResetPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!isValidEmail(email)) {
      setErr("Enter a valid email.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        (process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin) +
        "/auth/callback",
    });
    setPending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="relative rounded-sm border-hairline border-white/[0.08] bg-surface/80 backdrop-blur-md shadow-elevated">
      <div className="border-b-[0.5px] border-white/[0.06] px-6 py-5">
        <p className="text-eyebrow text-acid">Recovery</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          We'll send a single-use recovery link. The link expires in 15 minutes.
        </p>
      </div>

      <form onSubmit={onSubmit} className="px-6 py-6 space-y-5" noValidate>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="security@company.com"
          />
          <FieldError>{err}</FieldError>
        </div>

        {sent ? (
          <div
            role="status"
            className="rounded-sm border-hairline border-acid/40 bg-acid-wash px-3 py-2 text-xs text-acid"
          >
            Recovery link sent. Check your inbox.
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={pending || sent}
        >
          <Mail size={14} strokeWidth={1.75} />
          {pending ? "Sending…" : sent ? "Link sent" : "Send recovery link"}
        </Button>
      </form>

      <div className="border-t-[0.5px] border-white/[0.06] px-6 py-4 flex items-center justify-between text-xs text-foreground-muted">
        <span>Remembered it?</span>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1 text-foreground hover:text-acid transition-colors"
        >
          Back to sign in <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
