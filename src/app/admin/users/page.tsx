import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Users, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils";
import type { Database } from "@/types/supabase";
import { RoleActions } from "./role-actions";
import {
  UsersAnalyticsStrip,
  type UsersAnalyticsData,
} from "@/components/admin/users-analytics-strip";

function bucketSignupsByDay(dates: string[], days = 30): number[] {
  const buckets = Array.from({ length: days }, () => 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (const iso of dates) {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    const idx = days - 1 - diff;
    if (idx >= 0 && idx < days) buckets[idx]! += 1;
  }
  return buckets;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export const metadata = { title: "User Management" };

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type SubRow = { user_id: string; plan: string };

/* ─────────────────────────────────────────────────────────────────────────── */

export default async function UsersPage() {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, company_name, role, is_verified, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500) as {
    data: ProfileRow[] | null;
    error: { message: string } | null;
  };

  if (error) console.error("[admin/users]", error.message);
  const profiles = data ?? [];

  // Fetch all subscriptions so we can show current plan in Override dialog
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("user_id, plan") as { data: SubRow[] | null };
  const subMap: Record<string, string> = {};
  for (const s of subs ?? []) subMap[s.user_id] = s.plan;

  const totalUsers = profiles.length;
  const adminCount = profiles.filter((p) => p.role === "admin").length;
  const verifiedCount = profiles.filter((p) => p.is_verified).length;
  const recentCount = profiles.filter(
    (p) =>
      p.created_at &&
      new Date(p.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  ).length;

  const analyticsData: UsersAnalyticsData = {
    signupTrend: bucketSignupsByDay(
      profiles.map((p) => p.created_at).filter(Boolean) as string[],
    ),
    roleCounts: {
      admin: profiles.filter((p) => p.role === "admin").length,
      user: profiles.filter((p) => p.role === "client" || p.role === "user").length,
      other: profiles.filter(
        (p) => p.role !== "admin" && p.role !== "client" && p.role !== "user",
      ).length,
    },
    verifiedCount,
    unverifiedCount: totalUsers - verifiedCount,
    pendingVerification: profiles.filter((p) => !p.is_verified).length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin · Identity"
        title="User management"
        description="All registered operators. Promote to admin or toggle verification directly from this view."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      {/* KPIs */}
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile label="Total operators" value={totalUsers} tone="neutral" icon={Users} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Admins" value={adminCount} tone="admin" icon={ShieldAlert} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Verified" value={verifiedCount} tone="secure" icon={ShieldCheck} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Joined this week" value={recentCount} tone="neutral" icon={Clock} />
        </StaggerItem>
      </Stagger>

      <UsersAnalyticsStrip data={analyticsData} />

      {/* Directory table */}
      <div className="mt-4 rounded-sm border border-white/[0.06] bg-surface">
        <div className="border-b border-white/[0.06] px-5 py-3">
          <p className="text-sm font-medium text-foreground">
            All accounts{" "}
            <span className="ml-1 font-mono text-xs text-foreground-muted">
              ({totalUsers})
            </span>
          </p>
        </div>

        {profiles.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users yet"
            description="Once operators sign up, they appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-white/[0.04] text-left">
                  {["Operator", "Company", "Role", "Verified", "Joined", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.015]"
                  >
                    {/* Operator */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.full_name ?? "—"}</p>
                      <p className="font-mono text-[10px] text-foreground-subtle">{p.email}</p>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3 text-foreground-muted">
                      {p.company_name ?? "—"}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <Badge tone={p.role === "admin" ? "admin" : "neutral"}>
                        {p.role ?? "client"}
                      </Badge>
                    </td>

                    {/* Verified */}
                    <td className="px-4 py-3">
                      <Badge tone={p.is_verified ? "secure" : "warn"}>
                        {p.is_verified ? "Yes" : "Pending"}
                      </Badge>
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 font-mono text-foreground-muted">
                      {p.created_at ? formatRelativeTime(p.created_at) : "—"}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <RoleActions
                        userId={p.id}
                        userEmail={p.email ?? ""}
                        currentRole={p.role as "admin" | "client" | null}
                        isVerified={!!p.is_verified}
                        currentPlan={subMap[p.id] ?? "free"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-foreground-subtle">
        Role changes are immediate. Verification controls dashboard access gates.
      </p>
    </>
  );
}
