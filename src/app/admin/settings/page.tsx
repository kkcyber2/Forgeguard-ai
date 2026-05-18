import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Globe2,
  Bell,
  Cpu,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Admin Settings" };

/* ─────────────────────────────────────────────────────────────────────────── */

export default async function AdminSettingsPage() {
  const supabase = await createServerSupabase();

  // Pull a snapshot of cluster config flags that admins can inspect.
  // These are read-only here — actual mutation is done via Supabase dashboard
  // or migration scripts.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .limit(1)
    .single();

  const publicEnv = {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "not set",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "not set",
    anonKeyPresent: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  const serverEnvStatus = {
    lemonSqueezy:
      !!process.env.LEMONSQUEEZY_API_KEY &&
      !!process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
    groqProxy: !!process.env.GROQ_API_KEY || !!process.env.GROQ_PROXY_URL,
    scanSecret: !!process.env.SCAN_CREDENTIAL_SECRET,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin · Platform"
        title="Platform settings"
        description="Environment configuration overview and operational controls. Secrets are never rendered — only presence is shown."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      <div className="space-y-4">
        {/* ── Session ─────────────────────────────────────────────── */}
        <ConfigCard icon={ShieldCheck} eyebrow="Session" title="Current admin">
          <Row label="Email">{profile?.email ?? "—"}</Row>
          <Row label="Name">{profile?.full_name ?? "—"}</Row>
          <Row label="Role">
            <Badge tone="admin">{profile?.role ?? "admin"}</Badge>
          </Row>
        </ConfigCard>

        {/* ── Public env ──────────────────────────────────────────── */}
        <ConfigCard icon={Globe2} eyebrow="Public config" title="Environment">
          <Row label="App URL">
            <span className="font-mono text-xs text-foreground">{publicEnv.appUrl}</span>
          </Row>
          <Row label="Supabase URL">
            <span className="font-mono text-xs text-foreground truncate max-w-[200px]">
              {publicEnv.supabaseUrl}
            </span>
          </Row>
          <Row label="Anon key">
            <Badge tone={publicEnv.anonKeyPresent ? "secure" : "warn"}>
              {publicEnv.anonKeyPresent ? "Set" : "Missing"}
            </Badge>
          </Row>
        </ConfigCard>

        {/* ── Server secrets status ────────────────────────────────── */}
        <ConfigCard icon={Cpu} eyebrow="Server secrets" title="Integration status">
          <p className="mb-3 text-[11px] text-foreground-subtle">
            Secrets are not rendered. Only presence is shown.
          </p>
          <Row label="LemonSqueezy">
            <Badge tone={serverEnvStatus.lemonSqueezy ? "secure" : "warn"}>
              {serverEnvStatus.lemonSqueezy ? "Configured" : "Missing env vars"}
            </Badge>
          </Row>
          <Row label="Groq / Proxy">
            <Badge tone={serverEnvStatus.groqProxy ? "secure" : "warn"}>
              {serverEnvStatus.groqProxy ? "Configured" : "Missing"}
            </Badge>
          </Row>
          <Row label="Scan credential secret">
            <Badge tone={serverEnvStatus.scanSecret ? "secure" : "warn"}>
              {serverEnvStatus.scanSecret ? "Set" : "Missing — scheduled scans will fail"}
            </Badge>
          </Row>
          <Row label="DeepSeek API">
            <Badge tone={serverEnvStatus.deepseek ? "secure" : "neutral"}>
              {serverEnvStatus.deepseek ? "Configured" : "Not set (optional)"}
            </Badge>
          </Row>
        </ConfigCard>

        {/* ── Operational controls ─────────────────────────────────── */}
        <ConfigCard icon={Bell} eyebrow="Operations" title="Manual controls">
          <p className="text-[11px] text-foreground-muted leading-relaxed">
            The following operations are performed via the{" "}
            <span className="font-medium text-foreground">Supabase dashboard</span> or migration
            scripts. This panel is a reference — no mutations happen here.
          </p>
          <div className="mt-4 space-y-2 text-[11px] text-foreground-muted">
            {[
              "Run supabase/migrations/0003_audit_enhancements.sql to enable audit logging",
              "Set LEMONSQUEEZY_VARIANT_STARTUP and LEMONSQUEEZY_VARIANT_ENTERPRISE in Railway env",
              "Register webhook at /api/webhooks/lemonsqueezy for 6 event types in LemonSqueezy dashboard",
              "Configure Google OAuth Client ID/Secret in Supabase → Authentication → Providers",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 font-mono text-[9px] text-foreground-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </ConfigCard>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function ConfigCard({
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-white/[0.06] bg-surface">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
        <Icon size={12} strokeWidth={1.75} className="text-foreground-subtle" />
        <span className="text-eyebrow text-foreground-subtle">{eyebrow}</span>
        <span className="ml-auto text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="space-y-3 p-5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-foreground-subtle">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
