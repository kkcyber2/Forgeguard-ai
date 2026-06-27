/**
 * lib/aegis/closed-loop-match.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, dependency-free proof engine for the Aegis closed loop.
 *
 * Given a generated Aegis WAF rule (its Cloudflare expression + the canonical
 * verify snippet) and the exact attack payload that succeeded against the
 * target, this determines *deterministically* whether the rule would block
 * that payload. No live target is ever contacted — this is a local string/
 * regex proof, safe and fast.
 *
 * Kept separate from closed-loop.ts (which is `server-only` + Supabase-bound)
 * so the proof logic is unit-testable in isolation.
 */

import {
  techniqueKey,
  verifySnippetForTechnique,
  type ScanFinding,
} from "./ruleset-core";

/** Coerce a scan_logs payload (jsonb) + attack_name into a single searchable body string. */
export function payloadToBody(payload: unknown, attackName: string | null): string {
  if (payload == null) return attackName ?? "";
  if (typeof payload === "string") return payload;
  if (typeof payload === "number" || typeof payload === "boolean") return String(payload);
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

/**
 * Evaluate the *body* clauses of a Cloudflare WAF expression against a body.
 *
 * - `http.request.body.raw contains "LIT"` → case-insensitive substring match.
 * - `http.request.body.raw matches r"REGEX"` → JS RegExp test.
 *
 * `http.request.uri.path ...` clauses are path conditions and intentionally
 * ignored (the proof assumes the attack reaches an /api/ LLM endpoint, which
 * is the rule's scope). Within a body group, literals/regexes are OR-joined
 * by the `or` in the generated expression, so any one match is sufficient.
 */
export function expressionMatchesBody(expression: string, body: string): boolean {
  if (!body || !expression) return false;
  const lower = body.toLowerCase();

  const literalRe = /http\.request\.body\.raw\s+contains\s+"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = literalRe.exec(expression)) !== null) {
    const lit = m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (lit && lower.includes(lit.toLowerCase())) return true;
  }

  const regexRe = /http\.request\.body\.raw\s+matches\s+r"((?:[^"\\]|\\.)*)"/g;
  while ((m = regexRe.exec(expression)) !== null) {
    const src = m[1];
    if (!src) continue;
    try {
      if (new RegExp(src).test(body)) return true;
    } catch {
      // Malformed regex in the rule — skip rather than throw.
    }
  }

  return false;
}

/** Resolve the rule-generator technique key for a finding by attack_name. */
export function techniqueForFinding(attackName: string | null): string {
  return techniqueKey({
    id: 0,
    type: "finding",
    severity: "medium",
    attack_name: attackName,
    payload: null,
    created_at: "",
  } as ScanFinding);
}

export interface RuleProof {
  technique: string;
  afterBlocked: boolean;
}

/**
 * The core closed-loop proof. Returns `afterBlocked: true` when the generated
 * rule's expression (or its canonical verify snippet) matches the exact attack
 * payload body — i.e. deploying the rule would have blocked this attack.
 */
export function ruleBlocksPayload(
  expression: string,
  snippet: string | null,
  payload: unknown,
  attackName: string | null,
): RuleProof {
  const technique = techniqueForFinding(attackName);
  const body = payloadToBody(payload, attackName);
  const canonicalSnippet = snippet ?? verifySnippetForTechnique(technique);

  const afterBlocked =
    expressionMatchesBody(expression, body) ||
    (canonicalSnippet
      ? body.toLowerCase().includes(String(canonicalSnippet).toLowerCase())
      : false);

  return { technique, afterBlocked };
}
