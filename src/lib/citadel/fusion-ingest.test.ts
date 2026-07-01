import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildEntityUpserts,
  extractEntitiesFromDomain,
  linkEntities,
} from "@/lib/citadel/fusion-ingest";

test("extractEntitiesFromDomain normalizes root + subdomains", () => {
  const entities = extractEntitiesFromDomain("example.com", {
    subdomains: ["api.example.com", "www.example.com", "bad host"],
    dns: { a: ["93.184.216.34", "not-an-ip"] },
  });

  const values = entities.map((e) => e.value);
  assert.ok(values.includes("example.com"));
  assert.ok(values.includes("api.example.com"));
  assert.ok(values.includes("93.184.216.34"));
  assert.equal(values.filter((v) => v === "example.com").length, 1);
});

test("buildEntityUpserts attaches case and compartment", () => {
  const entities = extractEntitiesFromDomain("forgeguard.ai", {
    ct_logs: ["api.forgeguard.ai"],
  });
  const upserts = buildEntityUpserts(entities, "case-uuid");
  assert.ok(upserts.length >= 2);
  assert.equal(upserts[0].compartment_id, "00000000-0000-4000-8000-000000000001");
  assert.equal(upserts[0].case_id, "case-uuid");
});

test("linkEntities connects root to children", () => {
  const entities = extractEntitiesFromDomain("example.com", {
    subdomains: ["api.example.com"],
    ips: ["1.2.3.4"],
  });
  const links = linkEntities(entities, "example.com");
  assert.ok(links.some((l) => l.relationship === "has_subdomain"));
  assert.ok(links.some((l) => l.relationship === "resolves_to"));
  assert.equal(links[0].source_value, "example.com");
});
