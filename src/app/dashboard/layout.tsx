import * as React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ActivePath } from "@/components/dashboard/active-path";
import { StrongholdRecovering } from "@/components/dashboard/stronghold-recovering";
import {
  resolvePersona,
} from "@/lib/access/parallel-sovereignty";
import { loadDashboardShell } from "@/lib/dashboard/load-shell";
import {
  getSessionUser,
  getCurrentProfile,
} from "@/lib/supabase/server";
import { safeForceLogout } from "@/lib/auth/force-logout";
import { SOVEREIGN_VIOLATION_LOGIN } from "@/lib/auth/sovereign-violation";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";

/**
 * Authenticated dashboard shell — Parallel Sovereignty.
 * Shell loading is defensive: layout always renders Top Nav even when
 * telemetry subsystems fail.
 */

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/dashboard";

  const shellResult = await loadDashboardShell({
    userId: user.id,
    email: user.email ?? null,
    userMetadata: user.user_metadata as Record<string, unknown> | undefined,
    profile,
    pathname,
  });

  if (shellResult.ok && !shellResult.pathAllowed) {
    redirect(shellResult.redirectTo);
  }

  const { payload } = shellResult;
  const content = shellResult.ok ? (
    children
  ) : (
    <StrongholdRecovering
      message="Dashboard telemetry could not load. Top navigation remains active — reload to retry."
    />
  );

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
      {content}
    </ActivePath>
  );
}
