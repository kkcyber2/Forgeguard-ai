/**
 * Bypass-Native Bazaar fetch — certified catalog fallback on any primary failure.
 */

export interface BazaarListPayload {
  ok: boolean;
  scripts?: unknown[];
  total?: number;
  error?: string;
  fallback?: boolean;
}

export async function fetchBazaarCatalog(
  params: URLSearchParams,
): Promise<BazaarListPayload> {
  const isCertifiedOnly = params.get("certified") === "1";

  try {
    const res = await fetch(`/api/bazaar/list?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as BazaarListPayload;
    if (!data.ok) throw new Error(data.error ?? "Catalog unavailable");

    return data;
  } catch (primaryErr) {
    if (isCertifiedOnly) {
      return {
        ok: false,
        scripts: [],
        error: primaryErr instanceof Error ? primaryErr.message : "Network error",
      };
    }

    try {
      const certParams = new URLSearchParams({
        certified: "1",
        limit: params.get("limit") ?? "50",
      });
      const certRes = await fetch(`/api/bazaar/list?${certParams.toString()}`);
      const certData = (await certRes.json()) as BazaarListPayload;
      return {
        ok: true,
        scripts: certData.scripts ?? [],
        total: certData.total ?? certData.scripts?.length ?? 0,
        fallback: true,
      };
    } catch {
      return { ok: true, scripts: [], fallback: true };
    }
  }
}
