/**
 * Fusion ingest — pure entity extraction helpers for Citadel cases.
 */

import type {
  EntityLinkRow,
  EntityType,
  EntityUpsertRow,
  ExtractedEntity,
} from "@/lib/citadel/types";
import { DEFAULT_COMPARTMENT_ID } from "@/lib/citadel/types";

const DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

function normalizeDomain(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/^\*\./, "");
  const withoutWww = trimmed.replace(/^www\./, "");
  if (!DOMAIN_RE.test(withoutWww)) return null;
  return withoutWww;
}

function classifyDomain(value: string, rootDomain: string): EntityType {
  if (value === rootDomain) return "domain";
  if (value.endsWith(`.${rootDomain}`)) return "subdomain";
  return "domain";
}

export interface FusionOsintPayload {
  subdomains?: string[];
  ct_logs?: string[];
  dns?: { a?: string[]; mx?: string[]; txt?: string[] };
  emails?: string[];
  ips?: string[];
}

/** Extract normalized entities from a root domain + OSINT fusion payload. */
export function extractEntitiesFromDomain(
  rootDomain: string,
  payload: FusionOsintPayload,
  source = "fusion",
): ExtractedEntity[] {
  const root = normalizeDomain(rootDomain);
  if (!root) return [];

  const seen = new Set<string>();
  const out: ExtractedEntity[] = [];

  const push = (entity: ExtractedEntity) => {
    const key = `${entity.entity_type}:${entity.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entity);
  };

  push({
    entity_type: "domain",
    value: root,
    source,
    confidence: 1,
    metadata: { role: "root" },
  });

  for (const raw of payload.subdomains ?? []) {
    const d = normalizeDomain(raw);
    if (!d) continue;
    push({
      entity_type: classifyDomain(d, root),
      value: d,
      source: `${source}:subdomains`,
      confidence: 0.85,
    });
  }

  for (const raw of payload.ct_logs ?? []) {
    const d = normalizeDomain(raw);
    if (!d) continue;
    push({
      entity_type: classifyDomain(d, root),
      value: d,
      source: `${source}:ct_logs`,
      confidence: 0.9,
    });
  }

  for (const ip of payload.ips ?? payload.dns?.a ?? []) {
    const v = ip.trim();
    if (!IPV4_RE.test(v)) continue;
    push({
      entity_type: "ip",
      value: v,
      source: `${source}:dns`,
      confidence: 0.8,
    });
  }

  for (const raw of payload.emails ?? []) {
    const v = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(v)) continue;
    push({
      entity_type: "email",
      value: v,
      source,
      confidence: 0.75,
    });
  }

  for (const mx of payload.dns?.mx ?? []) {
    const host = mx.replace(/^\d+\s+/, "").trim().toLowerCase();
    const d = normalizeDomain(host);
    if (!d) continue;
    push({
      entity_type: classifyDomain(d, root),
      value: d,
      source: `${source}:mx`,
      confidence: 0.7,
      metadata: { record: "mx" },
    });
  }

  return out;
}

export function buildEntityUpserts(
  entities: ExtractedEntity[],
  caseId: string | null,
  compartmentId: string = DEFAULT_COMPARTMENT_ID,
): EntityUpsertRow[] {
  return entities.map((e) => ({
    compartment_id: compartmentId,
    case_id: caseId,
    entity_type: e.entity_type,
    value: e.value,
    source: e.source,
    confidence: e.confidence,
    metadata: e.metadata ?? {},
  }));
}

/** Build link rows between entities that share a parent domain. */
export function linkEntities(
  entities: ExtractedEntity[],
  rootDomain: string,
  compartmentId: string = DEFAULT_COMPARTMENT_ID,
): EntityLinkRow[] {
  const root = normalizeDomain(rootDomain);
  if (!root) return [];

  const links: EntityLinkRow[] = [];
  for (const e of entities) {
    if (e.value === root) continue;
    if (e.entity_type === "domain" || e.entity_type === "subdomain") {
      links.push({
        compartment_id: compartmentId,
        source_value: root,
        target_value: e.value,
        relationship: e.entity_type === "subdomain" ? "has_subdomain" : "related_to",
      });
    }
    if (e.entity_type === "ip") {
      links.push({
        compartment_id: compartmentId,
        source_value: root,
        target_value: e.value,
        relationship: "resolves_to",
      });
    }
    if (e.entity_type === "email") {
      links.push({
        compartment_id: compartmentId,
        source_value: root,
        target_value: e.value,
        relationship: "contact_at",
      });
    }
  }
  return links;
}
