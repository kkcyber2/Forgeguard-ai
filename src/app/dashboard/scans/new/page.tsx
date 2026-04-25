import * as React from "react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/shell";
import { getSessionUser } from "@/lib/supabase/server";
import { NewScanForm } from "./form";

/**
 * /dashboard/scans/new — launch page.
 * -----------------------------------
 * Server wrapper: enforces auth and hands the form (a Client Component)
 * the static copy. The actual Server Action lives in ../actions.ts and
 * is bound inside the client form via useActionState.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewScanPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/scans/new");

  return (
    <>
      <PageHeader
        eyebrow="Launch probe"
        title="New red-team scan"
        description="Paste the endpoint you want hardened and the API key ForgeGuard should use while probing. Credentials are sealed with AES-256-GCM before they touch the database."
      />
      <div className="mx-auto max-w-2xl">
        <NewScanForm />
      </div>
    </>
  );
}
