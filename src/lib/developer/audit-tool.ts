/**
 * Static audit for operator-authored custom attack tools.
 *
 * The Agathon Brain runs approved tools in a Docker sandbox, but the admin
 * audit queue still needs a fast, deterministic first pass that flags sandbox
 * escape / host-compromise primitives before a human approves the tool. This
 * is a signal, not a verdict — the sovereign admin makes the final call.
 */

export interface ToolAuditResult {
  risk_score: number;
  verdict: "clean" | "flagged" | "rejected";
  findings: string[];
  summary: string;
}

interface Rule {
  pattern: RegExp;
  label: string;
  weight: number;
  /** Disqualifying → verdict caps at "rejected". */
  disqualify?: boolean;
}

const RULES: Rule[] = [
  // Sandbox escape / arbitrary code execution — disqualifying.
  { pattern: /\bsubprocess\b|\bPopen\b|os\.system\s*\(|os\.popen\s*\(/, label: "subprocess / system shell", weight: 40, disqualify: true },
  { pattern: /\beval\s*\(|\bexec\s*\(/, label: "eval/exec dynamic code", weight: 35, disqualify: true },
  { pattern: /__import__\s*\(/, label: "__import__ dynamic import", weight: 30, disqualify: true },
  { pattern: /\bctypes\b/, label: "ctypes foreign-function interface", weight: 40, disqualify: true },
  { pattern: /\bpty\b/, label: "pty terminal allocation", weight: 30, disqualify: true },
  { pattern: /pickle\.loads?\s*\(|marshal\.loads?\s*\(/, label: "pickle/marshal deserialization (RCE)", weight: 35, disqualify: true },
  { pattern: /\bshutil\.(rmtree|move|copy)/, label: "shutil filesystem mutation", weight: 25, disqualify: true },
  { pattern: /os\.(remove|unlink|rmdir|rename|chmod|chown)\s*\(/, label: "os filesystem mutation", weight: 20, disqualify: true },

  // Network — allowed when network_allowed, but always surfaced for review.
  { pattern: /\bsocket\b|\brequests\b|\bhttpx\b|\baiohttp\b|\burllib\b|http\.client/, label: "network access", weight: 10 },
  // File I/O — medium risk in a sandboxed probe.
  { pattern: /\bopen\s*\(/, label: "file open()", weight: 10 },
  // Env / secrets.
  { pattern: /os\.environ|getenv\s*\(/, label: "environment / secret access", weight: 12 },
];

export function auditToolCode(code: string, networkAllowed = true): ToolAuditResult {
  const findings: string[] = [];
  let score = 0;
  let disqualified = false;

  for (const rule of RULES) {
    if (!rule.pattern.test(code)) continue;
    if (rule.label === "network access" && networkAllowed) {
      findings.push(`network access (allowed by tool config)`);
      continue;
    }
    findings.push(rule.label);
    score += rule.weight;
    if (rule.disqualify) disqualified = true;
  }

  score = Math.min(100, score);

  let verdict: ToolAuditResult["verdict"];
  if (disqualified || score >= 60) verdict = "rejected";
  else if (score >= 20 || findings.length > 0) verdict = "flagged";
  else verdict = "clean";

  const summaryParts = findings.length
    ? findings.slice(0, 6)
    : ["no dangerous primitives detected"];
  const summary = `risk=${score} verdict=${verdict} :: ${summaryParts.join("; ")}`;

  return { risk_score: score, verdict, findings, summary };
}
