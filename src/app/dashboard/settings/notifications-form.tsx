"use client";

import * as React from "react";
import { useActionState } from "react";
import { Bell, Loader2, Check } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { buttonStyles } from "@/components/ui/button";
import { saveNotificationPrefs, type NotifPrefsState } from "./notification-actions";

export interface NotifPrefsInitial {
  email_on_scan_complete: boolean;
  email_on_breach: boolean;
  webhook_url: string | null;
  webhook_secret: string | null;
}

const initial: NotifPrefsState = { ok: false };

export function NotificationsForm({ initialPrefs }: { initialPrefs: NotifPrefsInitial | null }) {
  const [state, formAction, pending] = useActionState(saveNotificationPrefs, initial);
  const prefs = initialPrefs ?? { email_on_scan_complete: true, email_on_breach: true, webhook_url: null, webhook_secret: null };

  return (
    <form action={formAction} className="space-y-5">
      <Toggle
        name="email_on_scan_complete"
        defaultChecked={prefs.email_on_scan_complete}
        label="Email me when a scan completes"
        hint="A summary with risk label, finding count, and ALE is sent on every sealed scan."
      />
      <Toggle
        name="email_on_breach"
        defaultChecked={prefs.email_on_breach}
        label="Email me the moment a breach is detected"
        hint="Real-time alert mid-scan as soon as the engine confirms a successful vector."
      />

      <div className="border-t border-white/[0.06] pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Bell size={12} strokeWidth={1.75} className="text-foreground-subtle" />
          <p className="text-eyebrow text-foreground-subtle">Outbound webhook</p>
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="webhook_url">Webhook URL (optional)</Label>
            <Input
              id="webhook_url"
              name="webhook_url"
              type="url"
              placeholder="https://hooks.example.com/forgeguard"
              defaultValue={prefs.webhook_url ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="webhook_secret">Signing secret (optional)</Label>
            <Input
              id="webhook_secret"
              name="webhook_secret"
              type="password"
              placeholder="used to HMAC-sign the X-ForgeGuard-Signature header"
              defaultValue={prefs.webhook_secret ?? ""}
            />
            <p className="mt-1.5 text-[11px] text-foreground-subtle">
              If set, each delivery is signed <code className="font-mono">sha256=&lt;hex&gt;</code> over the raw JSON body.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonStyles({ variant: "primary", size: "sm" })}>
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={1.75} />}
          Save notification preferences
        </button>
        {state.error ? (
          <p className="text-xs text-threat">{state.error}</p>
        ) : state.ok ? (
          <p className="text-xs text-acid">Saved.</p>
        ) : null}
      </div>
    </form>
  );
}

function Toggle({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-acid" />
      <span>
        <span className="block text-sm text-foreground">{label}</span>
        <span className="block text-[11px] text-foreground-subtle">{hint}</span>
      </span>
    </label>
  );
}
