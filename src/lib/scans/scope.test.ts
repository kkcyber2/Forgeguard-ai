import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeHost, isWithinScope } from "./scope.ts";

test("normalizeHost lowercases, strips www. and trailing dot", () => {
  assert.equal(normalizeHost("https://WWW.Example.com./v1/chat"), "example.com");
  assert.equal(normalizeHost("https://api.example.com:443/x"), "api.example.com");
  assert.equal(normalizeHost("http://example.com:80"), "example.com");
  assert.equal(normalizeHost("example.com"), "example.com");
  assert.equal(normalizeHost("https://www.sub.example.com"), "sub.example.com");
});

test("normalizeHost returns null for invalid input", () => {
  assert.equal(normalizeHost(""), null);
  assert.equal(normalizeHost("   "), null);
  assert.equal(normalizeHost("not a url at all with spaces"), null);
});

test("isWithinScope allows exact + subdomain, rejects unrelated + suffix traps", () => {
  assert.equal(isWithinScope("api.example.com", "example.com"), true);
  assert.equal(isWithinScope("example.com", "example.com"), true);
  assert.equal(isWithinScope("deep.a.b.example.com", "example.com"), true);
  // victim must be rejected
  assert.equal(isWithinScope("victim.com", "example.com"), false);
  // suffix-but-not-label trap
  assert.equal(isWithinScope("notexample.com", "example.com"), false);
  assert.equal(isWithinScope("evil.com", "xample.com"), false);
  // www normalization on both sides
  assert.equal(isWithinScope("www.example.com", "example.com"), true);
});
