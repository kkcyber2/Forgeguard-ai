"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";
import {
  exportTrainingCorpusToStorage,
  getTrainingCorpusExportUrl,
} from "@/lib/training/corpus";

export type TrainingCorpusStats = {
  eventCount: number;
  exportableCount: number;
  lastEventAt: string | null;
  lastExportPath: string | null;
};

export async function fetchTrainingCorpusStats(): Promise<TrainingCorpusStats> {
  await requireAdminProfile();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminSupabase() as any;

  const { count: eventCount } = await admin
    .from("training_corpus_events")
    .select("id", { count: "exact", head: true });

  const { count: exportableCount } = await admin
    .from("training_corpus_events")
    .select("id", { count: "exact", head: true })
    .eq("exportable", true);

  const { data: lastRow } = await admin
    .from("training_corpus_events")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: files } = await admin.storage
    .from("training-corpus-private")
    .list("exports", { limit: 1, sortBy: { column: "created_at", order: "desc" } });

  return {
    eventCount: eventCount ?? 0,
    exportableCount: exportableCount ?? 0,
    lastEventAt: lastRow?.created_at ?? null,
    lastExportPath: files?.[0]?.name ? `exports/${files[0].name}` : null,
  };
}

export async function runTrainingCorpusExport(): Promise<
  { ok: true; downloadUrl: string; rowCount: number } | { ok: false; error: string }
> {
  await requireAdminProfile();
  const admin = createAdminSupabase();
  const result = await exportTrainingCorpusToStorage(admin);
  if (!result.ok) return result;

  const url = await getTrainingCorpusExportUrl(admin, result.path);
  if (!url) {
    return { ok: false, error: "Export uploaded but signed URL failed" };
  }
  return { ok: true, downloadUrl: url, rowCount: result.rowCount };
}
