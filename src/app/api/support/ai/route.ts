import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openRouterRequestHeaders } from "@/lib/agathon-config";

export const runtime = "nodejs";
export const maxDuration = 30;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
});

const SYSTEM_PROMPT = `You are the ForgeGuard Compliance Expert — a sovereign AI support agent for ForgeGuard AI.

ForgeGuard quantifies adversarial risk for LLM deployments. Key concepts:
- $ALE (Annual Loss Expectancy): projected financial liability if a vulnerability is exploited (e.g. GDPR fines ~$150/record, data breach costs).
- Adversarial scans: prompt injection, jailbreak, BOLA/IDOR, logic discovery against customer endpoints.
- Plans: Hacker (free), Startup ($49/mo), Sovereign ($199/mo) with REST API access.

Rules:
- Explain vulnerabilities in plain language for security buyers and founders.
- When asked about pricing, mention Startup ($49) and Sovereign ($199).
- Never claim to run scans from chat — direct users to start a scan at /dashboard/scans/new.
- Keep answers concise (2–4 short paragraphs max).
- Do not invent CVE numbers or breach statistics without caveat.`;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid messages payload" }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Compliance bot offline",
        reply:
          "ForgeGuard quantifies adversarial risk ($ALE) for LLM endpoints. " +
          "Configure OPENROUTER_API_KEY to enable live compliance chat.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterRequestHeaders({
        apiKey,
        title: "ForgeGuard AI - Compliance Support",
      }),
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...parsed.data.messages,
        ],
        temperature: 0.4,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      const snippet = (await response.text().catch(() => "")).slice(0, 200);
      console.error("[support/ai] OpenRouter HTTP", response.status, snippet);
      return NextResponse.json(
        { error: "Model unavailable", reply: "Compliance expert is temporarily unavailable. Try again shortly." },
        { status: 502 },
      );
    }

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I could not generate a response. Please rephrase your question about LLM security or $ALE.";

    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[support/ai]", message);
    return NextResponse.json(
      { error: message, reply: "Compliance expert timed out. Please try again." },
      { status: 504 },
    );
  }
}
