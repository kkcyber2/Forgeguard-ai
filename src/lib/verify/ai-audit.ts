/**
 * Identity document AI audit — DeepSeek-R1 via OpenRouter.
 * Shared by /api/verify/ai-audit and local test script.
 */

export interface IdentityAuditInput {
  documentText: string;
  profileFullName: string;
  profileEmail: string;
}

export interface IdentityAuditResult {
  extracted_name: string;
  name_match: boolean;
  confidence_score: number;
  audit_notes: string;
  mode: "deepseek-r1" | "heuristic";
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function heuristicIdentityAudit(input: IdentityAuditInput): IdentityAuditResult {
  const profile = normalizeName(input.profileFullName || "");
  const doc = input.documentText.toLowerCase();
  const tokens = profile.split(" ").filter((t) => t.length > 1);
  const matched = tokens.length > 0 && tokens.every((t) => doc.includes(t));
  const score = matched ? 72 : 35;
  return {
    extracted_name: input.profileFullName,
    name_match: matched,
    confidence_score: score,
    audit_notes: matched
      ? "Heuristic: all profile name tokens found in document text."
      : "Heuristic: name tokens not fully present in document.",
    mode: "heuristic",
  };
}

function buildPrompt(input: IdentityAuditInput): string {
  return `You are an identity verification auditor for a security research platform.

Extract the legal full name from the identity document text below.
Compare it to the registered profile name.

Profile name: "${input.profileFullName}"
Profile email: "${input.profileEmail}"

Document text (OCR / upload):
"""
${input.documentText.slice(0, 8000)}
"""

Respond ONLY with valid JSON:
{
  "extracted_name": string,
  "name_match": boolean,
  "confidence_score": number (0-100),
  "audit_notes": string (one sentence)
}`;
}

export async function runIdentityAudit(
  input: IdentityAuditInput,
): Promise<IdentityAuditResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return heuristicIdentityAudit(input);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://forgeguard.ai",
        "X-Title": "ForgeGuard AI — Identity Auditor",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1",
        messages: [{ role: "user", content: buildPrompt(input) }],
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) return heuristicIdentityAudit(input);

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<IdentityAuditResult>;

    const profileNorm = normalizeName(input.profileFullName);
    const extractedNorm = normalizeName(parsed.extracted_name ?? "");
    const nameMatch =
      parsed.name_match ??
      (profileNorm.length > 0 &&
        extractedNorm.length > 0 &&
        (profileNorm === extractedNorm ||
          profileNorm.split(" ").every((t) => extractedNorm.includes(t))));

    return {
      extracted_name: parsed.extracted_name ?? input.profileFullName,
      name_match: nameMatch,
      confidence_score: Math.min(
        100,
        Math.max(0, Number(parsed.confidence_score) || (nameMatch ? 85 : 40)),
      ),
      audit_notes: parsed.audit_notes ?? "DeepSeek-R1 identity audit complete.",
      mode: "deepseek-r1",
    };
  } catch {
    return heuristicIdentityAudit(input);
  }
}
