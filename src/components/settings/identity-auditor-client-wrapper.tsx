"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const IdentityAuditorLazy = dynamic(
  () =>
    import("@/components/settings/identity-auditor").then(
      (m) => m.IdentityAuditor,
    ),
  { ssr: false },
);

export type IdentityAuditorClientWrapperProps = {
  documentPath: string | null;
  auditStatus: string;
  auditScore: number | null;
  profileFullName: string;
  sovereignBypass?: boolean;
};

/**
 * Client boundary for IdentityAuditor — avoids hydration mismatch from camera/Web APIs.
 */
export function IdentityAuditorClientWrapper(
  props: IdentityAuditorClientWrapperProps,
) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="min-h-[200px] rounded-xs border border-white/[0.06] bg-white/[0.02] animate-pulse"
        aria-hidden
      />
    );
  }

  return <IdentityAuditorLazy {...props} />;
}
