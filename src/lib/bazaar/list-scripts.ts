/**
 * Shared Bazaar listing — defensive against schema drift on production Supabase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { operatorAlias } from "@/lib/access/ghost-mode";
import type { Database } from "@/types/supabase";

type AuthorRow = {
  id: string;
  full_name: string | null;
  hacker_rank: string | null;
  is_ghost_active: boolean | null;
};

type ScriptRow = {
  id: string;
  name: string;
  description: string;
  language: string;
  tags: string[];
  price_usd: number;
  is_free?: boolean;
  purchase_count: number;
  audit_verdict: string;
  audit_risk_score: number;
  is_published: boolean;
  is_certified?: boolean;
  created_at: string;
  updated_at: string;
  author?: AuthorRow | AuthorRow[] | null;
};

export interface ListScriptsFilters {
  page: number;
  limit: number;
  tag: string | null;
  lang: string | null;
  freeOnly: boolean;
  certifiedOnly: boolean;
}

export interface ListScriptsResult {
  scripts: ScriptRow[];
  count: number | null;
  error?: string;
}

const FULL_SELECT = `
  id, name, description, language, tags,
  price_usd, is_free, purchase_count,
  audit_verdict, audit_risk_score,
  is_published, is_certified, created_at, updated_at,
  author:author_id (
    id, full_name, hacker_rank, is_ghost_active
  )
`;

const FALLBACK_SELECT = `
  id, name, description, language, tags,
  price_usd, purchase_count,
  audit_verdict, audit_risk_score,
  is_published, created_at, updated_at,
  author:author_id (
    id, full_name, hacker_rank, is_ghost_active
  )
`;

const MINIMAL_SELECT = `
  id, name, description, language, tags,
  price_usd, purchase_count,
  audit_verdict, audit_risk_score,
  is_published, created_at, updated_at
`;

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("42703") ||
    lower.includes("does not exist") ||
    lower.includes("is_free") ||
    lower.includes("is_certified") ||
    lower.includes("is_removed")
  );
}

function isEmbedError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("author") || lower.includes("embed") || lower.includes("relationship");
}

function maskAuthor(author: AuthorRow | null) {
  if (!author) return null;

  if (author.is_ghost_active) {
    const alias = operatorAlias(author.id);
    return {
      id: author.id,
      full_name: alias,
      username: alias,
      rank: author.hacker_rank ?? "ELITE",
      is_ghost: true as const,
    };
  }

  return {
    id: author.id,
    full_name: author.full_name ?? "anon",
    username: author.full_name?.split(" ")[0]?.toLowerCase() ?? "anon",
    rank: author.hacker_rank ?? "RECRUIT",
    is_ghost: false as const,
  };
}

function normalizeScript(row: ScriptRow) {
  const rawAuthor = row.author as AuthorRow | AuthorRow[] | null | undefined;
  const authorRow = Array.isArray(rawAuthor) ? rawAuthor[0] ?? null : rawAuthor ?? null;
  const price = Number(row.price_usd ?? 0);

  return {
    ...row,
    price_usd: price,
    is_free: row.is_free ?? price === 0,
    is_certified: row.is_certified ?? false,
    author: maskAuthor(authorRow),
  };
}

async function runQuery(
  supabase: SupabaseClient<Database>,
  select: string,
  filters: ListScriptsFilters,
  filterRemoved: boolean,
): Promise<{ data: ScriptRow[] | null; count: number | null; error: { message: string; code?: string } | null }> {
  const offset = (filters.page - 1) * filters.limit;

  let query = supabase
    .from("bazaar_scripts")
    .select(select, { count: "exact" })
    .eq("is_published", true)
    .eq("audit_verdict", "cleared")
    .order("purchase_count", { ascending: false })
    .range(offset, offset + filters.limit - 1);

  if (filterRemoved) {
    query = query.eq("is_removed", false);
  }

  if (filters.certifiedOnly && select.includes("is_certified")) {
    query = query.eq("is_certified", true);
  }
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.lang) query = query.eq("language", filters.lang);
  if (filters.freeOnly) {
    if (select.includes("is_free")) {
      query = query.eq("is_free", true);
    } else {
      query = query.eq("price_usd", 0);
    }
  }

  const { data, count, error } = await query;
  return {
    data: (data ?? null) as ScriptRow[] | null,
    count,
    error: error ? { message: error.message, code: error.code } : null,
  };
}

export async function listPublishedScripts(
  supabase: SupabaseClient<Database>,
  filters: ListScriptsFilters,
): Promise<ListScriptsResult> {
  const attempts: Array<{ select: string; filterRemoved: boolean }> = [
    { select: FULL_SELECT, filterRemoved: true },
    { select: FALLBACK_SELECT, filterRemoved: true },
    { select: MINIMAL_SELECT, filterRemoved: false },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { select, filterRemoved } = attempts[i]!;
    const { data, count, error } = await runQuery(
      supabase,
      select,
      filters,
      filterRemoved,
    );

    if (!error && data) {
      return {
        scripts: data,
        count,
      };
    }

    if (error) {
      console.error("[bazaar:list]", error.code ?? "err", error.message, `attempt=${i + 1}`);
      const retry =
        (isMissingColumnError(error.message) || isEmbedError(error.message)) &&
        i < attempts.length - 1;
      if (!retry) {
        return { scripts: [], count: 0, error: error.message };
      }
    }
  }

  return { scripts: [], count: 0, error: "Unable to load marketplace scripts." };
}

export { maskAuthor, normalizeScript };
