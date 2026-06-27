import { test } from "node:test";
import assert from "node:assert/strict";

import { computeEventHash } from "./audit-hash.ts";

test("computeEventHash is deterministic and 64-hex", () => {
  const h1 = computeEventHash(null, "scope_verified", "11111111-1111-1111-1111-111111111111", "2026-07-04T12:00:00.000Z");
  const h2 = computeEventHash(null, "scope_verified", "11111111-1111-1111-1111-111111111111", "2026-07-04T12:00:00.000Z");
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test("chain math: each link depends on the previous hash", () => {
  const scanId = "22222222-2222-2222-2222-222222222222";
  const events = ["scope_verified", "scan_started", "first_finding", "scan_sealed"];
  const ts = (i: number) => new Date(1_700_000_000_000 + i * 1000).toISOString();

  let prev: string | null = null;
  const hashes: string[] = [];
  for (let i = 0; i < events.length; i++) {
    const h = computeEventHash(prev, events[i], scanId, ts(i));
    hashes.push(h);
    prev = h;
  }

  // Recompute forward from genesis — must match exactly.
  let check: string | null = null;
  for (let i = 0; i < events.length; i++) {
    const h = computeEventHash(check, events[i], scanId, ts(i));
    assert.equal(h, hashes[i], `link ${i} must recompute identically`);
    check = h;
  }

  // Tampering any event must change that link's hash (and break the chain).
  const tampered = computeEventHash(hashes[1], "EVIL", scanId, ts(2));
  assert.notEqual(tampered, hashes[2]);
});
