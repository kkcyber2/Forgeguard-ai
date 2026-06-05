import * as React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import { redirect } from "next/navigation";
import { ActivePath } from "@/components/dashboard/active-path";
import { ShellDegradedBanner } from "@/components/dashboard/shell-degraded-banner";
import { resolvePersona } from "@/lib/access/parallel-sovereignty";
import { loadDashboardShell } from "@/lib/dashboard/load-shell";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import { safeForceLogout } from "@/lib/auth/force-logout";
import { SOVEREIGN_VIOLATION_LOGIN } from "@/lib/auth/sovereign-violation";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";

/**
 * Authenticated dashboard shell — Parallel Sovereignty.
 * Page content always renders; shell telemetry failures show a banner only.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/dashboard";

  if (pathname.startsWith("/dashboard/bunker")) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-foreground">
        {children}
      </div>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  let profile = await getCurrentProfile();
  if (!profile) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    profile = await getCurrentProfile();
  }

  if (!profile?.user_type) {
    redirect("/auth/signup/identity");
  }

  const persona = resolvePersona(
    profile.current_persona,
    profile.active_view_mode,
    profile.user_type,
  );

  if (persona === "dev") {
    if (!isSovereignOperator(user.email)) {
      await safeForceLogout();
      redirect(SOVEREIGN_VIOLATION_LOGIN);
    }
    redirect("/admin");
  }

  const shellResult = await loadDashboardShell({
    userId: user.id,
    email: user.email ?? null,
    userMetadata: user.user_metadata as Record<string, unknown> | undefined,
    profile,
    pathname,
  });

  if (!shellResult.pathAllowed && shellResult.redirectTo) {
    redirect(shellResult.redirectTo);
  }

  const { payload } = shellResult;

  return (
    <ActivePath
      primaryNav={payload.primaryNav}
      secondaryNav={payload.secondaryNav}
      nav={payload.nav}
      user={payload.user}
      scope="user"
      viewMode={payload.viewMode}
      sovereign={payload.sovereign}
      identityChosen={payload.identityChosen}
      canSwitchIdentity={payload.canSwitchIdentity}
    >
      {shellResult.degraded && (
        <ShellDegradedBanner message={shellResult.errorMessage} />
      )}
      {children}
    </ActivePath>
  );
}
