"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DEFAULT_COMPARTMENT_ID,
  requireCitadelAccess,
  requireCitadelCommander,
} from "@/lib/citadel/access";
import {
  buildEntityUpserts,
  extractEntitiesFromDomain,
  linkEntities,
  type FusionOsintPayload,
} from "@/lib/citadel/fusion-ingest";
import { createServerSupabase } from "@/lib/supabase/server";

const CreateCaseSchema = z.object({
  title: z.string().min(3).max(200),
  target_domain: z.string().min(3).max(253).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export async function createCase(formData: FormData) {
  const { userId } = await requireCitadelAccess();
  const parsed = CreateCaseSchema.safeParse({
    title: formData.get("title"),
    target_domain: formData.get("target_domain") || undefined,
    priority: formData.get("priority") || "medium",
  });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid case fields." };
  }

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: row, error } = await db
    .from("agency_cases")
    .insert({
      compartment_id: DEFAULT_COMPARTMENT_ID,
      title: parsed.data.title,
      target_domain: parsed.data.target_domain ?? null,
      priority: parsed.data.priority,
      created_by: userId,
      status: "open",
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  await db.from("agency_audit_events").insert({
    compartment_id: DEFAULT_COMPARTMENT_ID,
    actor_id: userId,
    action: "case_created",
    target_type: "case",
    target_id: row.id,
    meta: { title: parsed.data.title },
  });

  revalidatePath("/citadel");
  return { ok: true as const, caseId: row.id as string };
}

export async function runFusionIngest(caseId: string, payload: FusionOsintPayload) {
  const { userId } = await requireCitadelAccess();
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: caseRow, error: caseErr } = await db
    .from("agency_cases")
    .select("id, target_domain")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !caseRow?.target_domain) {
    return { ok: false as const, error: "Case not found or missing target domain." };
  }

  const entities = extractEntitiesFromDomain(caseRow.target_domain, payload);
  const upserts = buildEntityUpserts(entities, caseId);
  const links = linkEntities(entities, caseRow.target_domain);

  if (upserts.length > 0) {
    const { error: upsertErr } = await db
      .from("agency_entities")
      .upsert(upserts, { onConflict: "compartment_id,entity_type,value" });
    if (upsertErr) return { ok: false as const, error: upsertErr.message };
  }

  const { data: stored } = await db
    .from("agency_entities")
    .select("id, value")
    .eq("case_id", caseId);

  const byValue = new Map(
    (stored ?? []).map((r: { id: string; value: string }) => [r.value, r.id]),
  );

  for (const link of links) {
    const sourceId = byValue.get(link.source_value);
    const targetId = byValue.get(link.target_value);
    if (!sourceId || !targetId) continue;
    await db.from("agency_links").upsert(
      {
        compartment_id: link.compartment_id,
        source_entity_id: sourceId,
        target_entity_id: targetId,
        relationship: link.relationship,
      },
      { onConflict: "source_entity_id,target_entity_id,relationship" },
    );
  }

  await db.from("agency_audit_events").insert({
    compartment_id: DEFAULT_COMPARTMENT_ID,
    actor_id: userId,
    action: "fusion_ingest",
    target_type: "case",
    target_id: caseId,
    meta: { entity_count: upserts.length, link_count: links.length },
  });

  revalidatePath(`/citadel/cases/${caseId}`);
  revalidatePath("/citadel");
  return { ok: true as const, entityCount: upserts.length };
}

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["analyst", "viewer"]).default("analyst"),
});

export async function inviteMember(formData: FormData) {
  await requireCitadelCommander();
  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") || "analyst",
  });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid invite." };
  }

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email.toLowerCase())
    .maybeSingle();

  if (!profile?.id) {
    return {
      ok: false as const,
      error: "User must sign up before invite (profile not found).",
    };
  }

  const { error } = await db.from("agency_members").insert({
    compartment_id: DEFAULT_COMPARTMENT_ID,
    user_id: profile.id,
    role: parsed.data.role,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/citadel/roster");
  return { ok: true as const };
}

export async function createWatchlist(formData: FormData) {
  const { userId } = await requireCitadelAccess();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false as const, error: "Name too short." };

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("agency_watchlists")
    .insert({
      compartment_id: DEFAULT_COMPARTMENT_ID,
      name,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/citadel/watchlists");
  return { ok: true as const, watchlistId: data.id as string };
}

export async function runWatchlist(watchlistId: string) {
  const { userId } = await requireCitadelAccess();
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: items } = await db
    .from("agency_watchlist_items")
    .select("raw_value")
    .eq("watchlist_id", watchlistId);

  const domains = (items ?? []).map((i: { raw_value: string }) => i.raw_value);
  let ingested = 0;

  for (const domain of domains) {
    const entities = extractEntitiesFromDomain(domain, {});
    const upserts = buildEntityUpserts(entities, null);
    if (upserts.length === 0) continue;
    const { error } = await db
      .from("agency_entities")
      .upsert(upserts, { onConflict: "compartment_id,entity_type,value" });
    if (!error) ingested += upserts.length;
  }

  await db
    .from("agency_watchlists")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", watchlistId);

  await db.from("agency_audit_events").insert({
    compartment_id: DEFAULT_COMPARTMENT_ID,
    actor_id: userId,
    action: "watchlist_run",
    target_type: "watchlist",
    target_id: watchlistId,
    meta: { ingested },
  });

  revalidatePath("/citadel/watchlists");
  return { ok: true as const, ingested };
}

export async function runWatchlistAction(watchlistId: string): Promise<void> {
  await runWatchlist(watchlistId);
}

export async function createCaseAction(formData: FormData): Promise<void> {
  await createCase(formData);
}

export async function inviteMemberAction(formData: FormData): Promise<void> {
  await inviteMember(formData);
}

export async function createWatchlistAction(formData: FormData): Promise<void> {
  await createWatchlist(formData);
}

export async function runFusionIngestForCase(formData: FormData): Promise<void> {
  const caseId = String(formData.get("caseId") ?? "");
  if (!caseId) return;

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: caseRow } = await (supabase as any)
    .from("agency_cases")
    .select("target_domain")
    .eq("id", caseId)
    .maybeSingle();

  const domain = caseRow?.target_domain as string | undefined;
  if (!domain) return;

  await runFusionIngest(caseId, {
    subdomains: [`api.${domain}`, `www.${domain}`],
    ct_logs: [`mail.${domain}`],
  });
}
