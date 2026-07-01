import "server-only";

import { DEFAULT_COMPARTMENT_ID } from "@/lib/citadel/types";
import type {
  AgencyAuditEvent,
  AgencyCase,
  AgencyEntity,
  AgencyMember,
  AgencyTask,
  AgencyWatchlist,
  FusionDashboardData,
  LeadRow,
} from "@/lib/citadel/types";
import { createServerSupabase } from "@/lib/supabase/server";

export async function fetchCitadelDashboard(): Promise<FusionDashboardData> {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [
    compartmentRes,
    memberRes,
    casesRes,
    entitiesRes,
    tasksRes,
    watchlistsRes,
    auditRes,
    leadsRes,
  ] = await Promise.all([
    db
      .from("agency_compartments")
      .select("*")
      .eq("id", DEFAULT_COMPARTMENT_ID)
      .maybeSingle(),
    db
      .from("agency_members")
      .select("*")
      .eq("compartment_id", DEFAULT_COMPARTMENT_ID)
      .limit(1),
    db
      .from("agency_cases")
      .select("*")
      .eq("compartment_id", DEFAULT_COMPARTMENT_ID)
      .order("updated_at", { ascending: false })
      .limit(12),
    db
      .from("agency_entities")
      .select("*")
      .eq("compartment_id", DEFAULT_COMPARTMENT_ID)
      .order("created_at", { ascending: false })
      .limit(24),
    db
      .from("agency_tasks")
      .select("*")
      .eq("compartment_id", DEFAULT_COMPARTMENT_ID)
      .order("created_at", { ascending: false })
      .limit(8),
    db
      .from("agency_watchlists")
      .select("*")
      .eq("compartment_id", DEFAULT_COMPARTMENT_ID)
      .order("created_at", { ascending: false }),
    db
      .from("agency_audit_events")
      .select("*")
      .eq("compartment_id", DEFAULT_COMPARTMENT_ID)
      .order("created_at", { ascending: false })
      .limit(20),
    db.from("leads").select("id", { count: "exact", head: true }),
  ]);

  return {
    compartment: (compartmentRes.data as FusionDashboardData["compartment"]) ?? null,
    member: ((memberRes.data as AgencyMember[]) ?? [])[0] ?? null,
    cases: (casesRes.data as AgencyCase[]) ?? [],
    entities: (entitiesRes.data as AgencyEntity[]) ?? [],
    tasks: (tasksRes.data as AgencyTask[]) ?? [],
    watchlists: (watchlistsRes.data as AgencyWatchlist[]) ?? [],
    auditEvents: (auditRes.data as AgencyAuditEvent[]) ?? [],
    leadsCount: leadsRes.count ?? 0,
  };
}

export async function fetchCaseDetail(caseId: string) {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [caseRes, entitiesRes, notesRes] = await Promise.all([
    db.from("agency_cases").select("*").eq("id", caseId).maybeSingle(),
    db
      .from("agency_entities")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    db
      .from("agency_case_notes")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    case: caseRes.data as AgencyCase | null,
    entities: (entitiesRes.data as AgencyEntity[]) ?? [],
    notes: notesRes.data ?? [],
  };
}

export async function fetchLeads(limit = 50): Promise<LeadRow[]> {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("leads")
    .select(
      "id, company_name, website_url, founder_name, email, status, rank, source, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as LeadRow[]) ?? [];
}

export async function fetchRoster(): Promise<AgencyMember[]> {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("agency_members")
    .select("*")
    .eq("compartment_id", DEFAULT_COMPARTMENT_ID)
    .order("created_at", { ascending: true });
  return (data as AgencyMember[]) ?? [];
}

export async function fetchWatchlistsWithItems() {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: lists } = await db
    .from("agency_watchlists")
    .select("*")
    .eq("compartment_id", DEFAULT_COMPARTMENT_ID)
    .order("created_at", { ascending: false });

  const watchlists = (lists as AgencyWatchlist[]) ?? [];
  const withItems = await Promise.all(
    watchlists.map(async (w) => {
      const { data: items } = await db
        .from("agency_watchlist_items")
        .select("*")
        .eq("watchlist_id", w.id);
      return { ...w, items: items ?? [] };
    }),
  );
  return withItems;
}
