import { unstable_cache } from "next/cache";

export interface ExternalIntelItem {
  id: string;
  title: string;
  vendor: string;
  product: string;
  dateAdded: string;
  source: "cisa-kev";
}

const CISA_KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

async function fetchCisaKevRaw(): Promise<ExternalIntelItem[]> {
  try {
    const res = await fetch(CISA_KEV_URL, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      vulnerabilities?: Array<{
        cveID?: string;
        vulnerabilityName?: string;
        vendorProject?: string;
        product?: string;
        dateAdded?: string;
      }>;
    };
    const rows = json.vulnerabilities ?? [];
    return rows.slice(0, 12).map((v) => ({
      id: v.cveID ?? `kev-${v.vulnerabilityName ?? "unknown"}`,
      title: v.vulnerabilityName ?? v.cveID ?? "KEV entry",
      vendor: v.vendorProject ?? "—",
      product: v.product ?? "—",
      dateAdded: v.dateAdded ?? "",
      source: "cisa-kev" as const,
    }));
  } catch {
    return [];
  }
}

export const getExternalIntelStrip = unstable_cache(
  async () => fetchCisaKevRaw(),
  ["live-map-external-cisa-kev"],
  { revalidate: 3600, tags: ["external-intel-kev"] },
);
