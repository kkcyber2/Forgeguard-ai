import * as React from "react";
import { redirect } from "next/navigation";
import { KeyRound, ShieldAlert, User2, Globe, PenLine, Bell } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { getCurrentProfile, getSessionUser, createServerSupabase } from "@/lib/supabase/server";
import { fetchSettingsPageData } from "@/lib/dashboard/fetch-settings";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { ApiKeysSection } from "./api-keys-section";
import { NotificationsForm, type NotifPrefsInitial } from "./notifications-form";
import { SignaturePad } from "@/components/settings/signature-pad";
import { DomainVerifier } from "@/components/settings/domain-verifier";
import {
  SettingsClearanceAside,
  SettingsClearanceProvider,
} from "@/components/settings/settings-clearance-aside";
import { FaceLiveness } from "@/components/settings/face-liveness";
import { IdentityAuditorClientWrapper } from "@/components/settings/identity-auditor-client-wrapper";
import { GhostProtocolToggle } from "@/components/dashboard/ghost-protocol-toggle";
import { OperatorLeaderboard } from "@/components/dashboard/operator-leaderboard";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { DeleteAccountButton } from "@/components/settings/delete-account-button";
import { TrainingCorpusOptOut } from "@/components/settings/training-corpus-opt-out";
import { MfaSettingsStub } from "@/components/settings/mfa-settings-stub";
import { TeamE2eeStub } from "@/components/settings/team-e2ee-stub";

/**
 * /dashboard/settings — operator profile management.
 * Defensive rendering: all Supabase fetches degrade safely.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/settings");

  let profile = await getCurrentProfile();
  if (!profile) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    profile = await getCurrentProfile();
  }

  const data = await fetchSettingsPageData(user, profile);
  const sovereignBypass = isSovereignOperator(user.email);

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: notifPrefsRow } = await (supabase as any)
    .from("notification_preferences")
    .select("email_on_scan_complete, email_on_breach, webhook_url, webhook_secret")
    .eq("user_id", user.id)
    .maybeSingle();
  const notifPrefs = (notifPrefsRow ?? null) as NotifPrefsInitial | null;

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Settings"
        description="Account identity and credentials. Anything sensitive triggers a re-auth before it sticks."
      />

      <SettingsClearanceProvider initialDocUploaded={!!data.docPath}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <aside className="order-1 space-y-4 lg:order-none lg:col-start-2 lg:row-span-2">
          <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5 lg:hidden">
            <SettingsClearanceAside
              emailVerified={data.emailVerified}
              faceLivenessVerified={data.faceLivenessVerified}
              domainVerified={data.domainVerified}
              hasSignature={data.hasSignature}
              identityDocUploaded={!!data.docPath}
              identityVerified={data.identityVerified}
              clearanceTier={data.clearanceTier}
              auditScore={data.auditScore}
              sovereignPending={data.sovereignPending}
            />
          </div>
        </aside>

        <div className="order-2 flex flex-col gap-6 lg:order-none lg:col-start-1">
          <Section id="profile" icon={User2} eyebrow="Identity" title="Profile">
            <ProfileForm
              initial={{
                full_name: data.profile?.full_name ?? "",
                company_name: data.profile?.company_name ?? "",
                phone: data.profile?.phone ?? "",
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
            <ApiKeysSection initialKeys={data.apiKeys} />
          </Section>

          <Section
            id="notifications"
            icon={Bell}
            eyebrow="Alerting"
            title="Notifications"
          >
            <NotificationsForm initialPrefs={notifPrefs} />
          </Section>

          <TrainingCorpusOptOut
            userId={user.id}
            initialOptOut={Boolean(data.profile?.training_corpus_opt_out)}
          />
          <MfaSettingsStub />
          <TeamE2eeStub />

          <Section
            id="domain"
            icon={Globe}
            eyebrow="Corporate verification"
            title="Domain Verification"
          >
            <DomainVerifier
              existingDomain={(data.profile?.company_domain as string | null) ?? null}
              domainVerified={data.domainVerified}
              companyTag={(data.profile?.company_tag as string | null) ?? null}
              workEmailVerified={Boolean(data.profile?.work_email_verified)}
            />
          </Section>

          <Section
            id="signature"
            icon={PenLine}
            eyebrow="Legal armor"
            title="Digital Signature"
          >
            <SignaturePad
              existingSignature={(data.profile?.signature_data as string | null) ?? null}
            />
          </Section>

          <Section
            id="clearance"
            icon={ShieldAlert}
            eyebrow="Sovereign pipeline"
            title="Clearance & Verification"
          >
            <div className="flex flex-col gap-8">
              <FaceLiveness
                verified={data.faceLivenessVerified}
                poseCount={data.faceLivenessPoseCount}
              />
              <IdentityAuditorClientWrapper
                documentPath={data.docPath}
                auditStatus={data.profile?.identity_audit_status ?? "none"}
                auditScore={data.auditScore}
                profileFullName={data.profile?.full_name ?? ""}
                initialFailureReason={data.profile?.identity_failure_reason ?? null}
                sovereignBypass={sovereignBypass}
              />
            </div>
          </Section>
        </div>

        <aside className="order-3 hidden space-y-4 lg:order-none lg:col-start-2 lg:block">
          <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
            <p className="text-eyebrow text-foreground-subtle mb-3">Stealth</p>
            <GhostProtocolToggle compact />
          </div>

          <SettingsClearanceAside
            emailVerified={data.emailVerified}
            faceLivenessVerified={data.faceLivenessVerified}
            domainVerified={data.domainVerified}
            hasSignature={data.hasSignature}
            identityDocUploaded={!!data.docPath}
            identityVerified={data.identityVerified}
            clearanceTier={data.clearanceTier}
            auditScore={data.auditScore}
            sovereignPending={data.sovereignPending}
          />

          <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
            <p className="text-eyebrow text-foreground-subtle mb-3">Operator leaderboard</p>
            <OperatorLeaderboard limit={6} />
          </div>

          <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
            <p className="text-eyebrow text-foreground-subtle">Account</p>
            <dl className="mt-3 space-y-3 text-xs">
              <Row label="Email">
                <span className="block max-w-[160px] truncate text-right font-mono text-foreground">
                  {user.email}
                </span>
              </Row>
              <Row label="Role">
                <Badge tone={data.profile?.role === "admin" ? "admin" : "neutral"}>
                  {data.profile?.role === "admin" ? "Admin" : "Operator"}
                </Badge>
              </Row>
              <Row label="Verified">
                <Badge tone={data.profile?.is_verified ? "secure" : "warn"}>
                  {data.profile?.is_verified ? "Yes" : "Pending"}
                </Badge>
              </Row>
              <Row label="Last sign-in">
                <span className="font-mono text-foreground-muted">
                  {data.lastSignIn
                    ? new Date(data.lastSignIn).toLocaleString()
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
            <DeleteAccountButton
              deletionRequestedAt={data.profile?.deletion_requested_at ?? null}
            />
          </div>
        </aside>
      </div>
      </SettingsClearanceProvider>
    </>
  );
}

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
