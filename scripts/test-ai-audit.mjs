/**
 * Local AI audit smoke test (no Next.js server required).
 * Run: node scripts/test-ai-audit.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Dynamic import of compiled TS is awkward; inline minimal test of heuristic path
function normalizeName(s) {
  return s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function heuristicIdentityAudit(input) {
  const profile = normalizeName(input.profileFullName || "");
  const doc = input.documentText.toLowerCase();
  const tokens = profile.split(" ").filter((t) => t.length > 1);
  const matched = tokens.length > 0 && tokens.every((t) => doc.includes(t));
  return {
    extracted_name: input.profileFullName,
    name_match: matched,
    confidence_score: matched ? 72 : 35,
    mode: "heuristic",
  };
}

const cases = [
  {
    profileFullName: "Alex Chen",
    profileEmail: "alex@forgeguard.ai",
    documentText: "GOVERNMENT ID — Name: Alex Chen — Authorized researcher",
  },
  {
    profileFullName: "Alex Chen",
    profileEmail: "alex@forgeguard.ai",
    documentText: "Name: Jordan Smith — unrelated document",
  },
];

let passed = 0;
for (const c of cases) {
  const r = heuristicIdentityAudit(c);
  const expectMatch = c.documentText.includes("Alex Chen");
  const ok = r.name_match === expectMatch;
  console.log(ok ? "PASS" : "FAIL", c.profileFullName, "→", r.name_match, r.confidence_score);
  if (ok) passed++;
}

if (process.env.OPENROUTER_API_KEY) {
  console.log("\nOPENROUTER_API_KEY set — run full test via: npm run build && curl POST /api/verify/ai-audit");
} else {
  console.log("\nHeuristic-only mode (set OPENROUTER_API_KEY for DeepSeek-R1 live test).");
}

process.exit(passed === cases.length ? 0 : 1);
