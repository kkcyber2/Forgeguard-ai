import * as React from "react";
import { redirect } from "next/navigation";
import { KeyRound, ShieldAlert, User2 } from "lucide-react";
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

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Settings"
        description="Account identity and credentials. Anything sensitive triggers a re-auth before it sticks."
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Section icon={User2} eyebrow="Identity" title="Profile">
            <ProfileForm
              initial={{
                full_name: profile?.full_name ?? "",
                company_name: profile?.company_name ?? "",
                phone: profile?.phone ?? "",
              }}
            />
          </Section>

          <Section
            icon={ShieldAlert}
            eyebrow="Credential rotation"
            title="Password"
          >
            <PasswordForm />
          </Section>

          <Section
            icon={KeyRound}
            eyebrow="CI/CD integration"
            title="API Keys"
          >
            <ApiKeysSection initialKeys={apiKeys} />
          </Section>
        </div>

        <aside className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
          <p className="text-eyebrow text-foreground-subtle">Account</p>
          <dl className="mt-3 space-y-3 text-xs">
            <Row label="Email">
              <span className="font-mono text-foreground">{user.email}</span>
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
        </aside>
      </div>
    </>
  );
}

function Section({
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
    <section className="rounded-sm border-hairline border-white/[0.06] bg-surface">
      <div className="flex items-center gap-2 border-b-[0.5px] border-white/[0.06] px-5 py-4">
        <Icon size={12} strokeWidth={1.75