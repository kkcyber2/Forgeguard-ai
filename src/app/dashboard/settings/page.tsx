import * as React from "react";
import { redirect } from "next/navigation";
import { KeyRound, ShieldAlert, User2, Globe, PenLine, Camera } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import {
  createServerSupabase,
  getCurrentProfile,
  getSessionUser,
} from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { ApiKeysSection, type ApiKeyRow } from "./api-keys-section";
import { SignaturePad } from "@/components/settings/signature-pad";
import { DomainVerifier } from "@/components/settings/domain-verifier";
import { WebcamIdentity } from "@/components/settings/webcam-identity";
import { ClearanceProgress } from "@/components/settings/clearance-progress";
import { PhoneVerification } from "@/components/settings/phone-verification";
import { IdentityAuditor } from "@/components/settings/identity-auditor";
import { OperatorLeaderboard } from "@/components/dashboard/operator-leaderboard";

/**
 * /dashboard/settings — operator profile management.
 * --------------------------------------------------
 * Server-rendered shell + two client forms (profile + password) wired
 * to Server Actions. Anything role-gated stays read-only here; admins
 * promote/demote users from /admin/users.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/settings");

  const profile = await getCurrentProfile();

  // Last sign-in for the audit panel — pulled directly from Supabase auth.
  const supabase = await createServerSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const lastSignIn = sessionData.session?.user.last_sign_in_at ?? null;

  // Fetch user's API keys for the CI/CD section
  const { data: rawKeys } = await supabase
    .from("user_api_keys")
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });

  const apiKeys: ApiKeyRow[] = (rawKeys ?? []) as ApiKeyRow[];

  // Derive verification booleans server-side to pass to VerificationProgress
  const emailVerified = !!(user as { email_confirmed_at?: string | null })
    .email_confirmed_at;
  const phoneVerified = profile?.phone_verified ?? false;
  const domainVerified = profile?.domain_verified ?? false;
  const hasSignature = !!profile?.signature_data;
  const identityProofed = profile?.identity_proofed ?? false;
  const identityVerified = profile?.identity_verified ?? false;
  const clearanceTier = (profile?.clearance_tier ?? "tactical") as
    | "tactical"
    | "professional"
    | "sovereign";
  const auditScore = profile?.identity_audit_score
    ? Number(profile.identity_audit_score)
    : null;
  const sovereignPending = profile?.sovereign_pending ?? false;
  const docPath = profile?.identity_document_path ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Settings"
        description="Account identity and credentials. Anything sensitive triggers a re-auth before it sticks."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left column: forms ─────────────────────────── */}
        <div className="space-y-6">
          <Section id="profile" icon={User2} eyebrow="Identity" title="Profile">
            <ProfileForm
              initial={{
                full_name: profile?.full_name ?? "",
                company_name: profile?.company_name ?? "",
                phone: profile?.phone ?? "",
              }}
            />
          </Section>

          <Section
            id="password"
            icon={ShieldAlert}
            eyebrow="Credential rotation"
            title="Password"
          >
            <PasswordForm />
          </Section>

          <Section
            id="api-keys"
            icon={KeyRound}
            eyebrow="CI/CD integration"
            title="API Keys"
          >
            <ApiKeysSection initialKeys={apiKeys} />
          </Section>

          {/* ── Sovereign Identity ───────────────────────── */}
          <Section
            id="domain"
            icon={Globe}
            eyebrow="Corporate verification"
            title="Domain Verification"
          >
            <DomainVerifier
              existingDomain={(profile?.company_domain as string | null) ?? null}
              domainVerified={domainVerified}
            />
          </Section>

          <Section
            id="signature"
            icon={PenLine}
            eyebrow="Legal armor"
            title="Digital Signature"
          >
            <SignaturePad
              existingSignature={(profile?.signature_data as string | null) ?? null}
            />
          </Section>

          <Section
            id="clearance"
            icon={ShieldAlert}
            eyebrow="Sovereign pipeline"
            title="Clearance & Verification"
          >
            <div className="space-y-8">
              <PhoneVerification
                initialPhone={profile?.phone ?? ""}
                phoneVerified={phoneVerified}
              />
              <IdentityAuditor
                documentPath={docPath}
                auditStatus={profile?.identity_audit_status ?? "none"}
                auditScore={auditScore}
              />
            </div>
          </Section>

          <Section
            id="identity"
            icon={Camera}
            eyebrow="Enterprise missions"
            title="Identity Proofing"
          >
            <WebcamIdentity verified={identityProofed} />
          </Section>
        </div>

        {/* ── Right sidebar ──────────────────────────────── */}
        <aside className="space-y-4">
          {/* Verification progress widget */}
          <ClearanceProgress
            emailVerified={emailVerified}
            phoneVerified={phoneVerified}
            domainVerified={domainVerified}
            hasSignature={hasSignature}
            identityDocUploaded={!!docPath}
            identityVerified={identityVerified}
            clearanceTier={clearanceTier}
            auditScore={auditScore}
            sovereignPending={sovereignPending}
          />

          <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
            <p className="text-eyebrow text-foreground-subtle mb-3">Operator leaderboard</p>
            <OperatorLeaderboard limit={6} />
          </div>

          {/* Account info card */}
          <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
            <p className="text-eyebrow text-foreground-subtle">Account</p>
            <dl className="mt-3 space-y-3 text-xs">
              <Row label="Email">
                <span className="block max-w-[160px] truncate text-right font-mono text-foreground">
                  {user.email}
                </span>
              </Row>
              <Row label="Role">
                <Badge tone={profile?.role === "admin" ? "admin" : "neutral"}>
                  {profile?.role === "admin" ? "Admin" : "Operator"}
                </Badge>
              </Row>
              <Row label="Verified">
                <Badge tone={profile?.is_verified ? "secure" : "warn"}>
                  {profile?.is_verified ? "Yes" : "Pending"}
                </Badge>
              </Row>
              <Row label="Last sign-in">
                <span className="font-mono text-foreground-muted">
                  {lastSignIn
                    ? new Date(lastSignIn).toLocaleString()
                    : "—"}
                </span>
              </Row>
              <Row label="User ID">
                <span className="break-all font-mono text-[10px] text-foreground-subtle">
                  {user.id}
                </span>
              </Row>
            </dl>
            <form action="/auth/signout" method="post" className="mt-5">
              <button
                type="submit"
                className="w-full rounded-sm border-hairline border-threat/40 bg-threat/10 py-2 text-xs font-medium uppercase tracking-[0.14em] text-threat transition-colors hover:bg-threat/15"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}

/* ── Layout helpers ─────────────────────────────────────────────────────── */

function Section({
  id,
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-sm border-hairline border-white/[0.06] bg-surface"
    >
      <div className="flex items-center gap-2 border-b-[0.5px] border-white/[0.06] px-5 py-4">
        <Icon size={12} strokeWidth={1.75} className="text-foreground-subtle" />
        <p className="text-eyebrow text-foreground-subtle">{eyebrow}</p>
        <span className="ml-auto text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-foreground-subtle">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
