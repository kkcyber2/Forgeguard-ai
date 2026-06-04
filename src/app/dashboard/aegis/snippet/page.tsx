"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Check, Shield, ArrowLeft } from "lucide-react";

function useAppOrigin() {
  const [origin, setOrigin] = React.useState("https://www.forgeguard-ai.com");
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);
  return origin;
}

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">
          {label}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[#D1FF00] hover:text-white"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-[#E5E7EB]"
        style={{ background: "#050505", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {code}
      </pre>
    </div>
  );
}

export default function AegisSnippetPage() {
  const origin = useAppOrigin();
  const [appId, setAppId] = React.useState("my-app-id");
  const verifyUrl = `${origin}/api/v1/aegis/verify`;

  const nodeSnippet = `// ForgeGuard Aegis Proxy — Node.js / Express middleware
const AEGIS_VERIFY_URL = "${verifyUrl}";
const AEGIS_APP_ID = "${appId}";

export async function aegisVerifyPrompt(prompt) {
  const res = await fetch(AEGIS_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, appId: AEGIS_APP_ID }),
  });
  const data = await res.json();
  return Boolean(data.allowed);
}

export function aegisMiddleware() {
  return async (req, res, next) => {
    const prompt = req.body?.prompt ?? req.body?.messages?.slice(-1)?.[0]?.content;
    if (!prompt) return next();
    const allowed = await aegisVerifyPrompt(String(prompt));
    if (!allowed) {
      return res.status(403).json({ error: "Blocked by ForgeGuard Aegis Shield" });
    }
    next();
  };
}`;

  const pythonSnippet = `# ForgeGuard Aegis Proxy — Python / FastAPI middleware
import httpx

AEGIS_VERIFY_URL = "${verifyUrl}"
AEGIS_APP_ID = "${appId}"

async def aegis_verify_prompt(prompt: str) -> bool:
    async with httpx.AsyncClient(timeout=2.0) as client:
        resp = await client.post(
            AEGIS_VERIFY_URL,
            json={"prompt": prompt, "appId": AEGIS_APP_ID},
        )
        data = resp.json()
        return bool(data.get("allowed", False))

# FastAPI dependency example:
# allowed = await aegis_verify_prompt(user_prompt)
# if not allowed: raise HTTPException(403, "Blocked by Aegis Shield")`;

  return (
    <div className="min-h-screen px-6 py-8" style={{ background: "#050505" }}>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <Link
            href="/dashboard/aegis"
            className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[#6B7280] hover:text-[#D1FF00]"
          >
            <ArrowLeft size={14} />
            Back to Aegis Shield
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-[#D1FF00]" />
            <h1 className="font-mono text-xl font-bold text-white">Aegis Proxy Snippet</h1>
          </div>
          <p className="text-sm text-[#9CA3AF]">
            Copy-paste middleware that calls the Edge verify API before your LLM handler runs.
            Target latency: under 50ms on Vercel Edge.
          </p>
        </div>

        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">
            App ID (matches aegis_shield_rules.app_id)
          </label>
          <input
            className="w-full bg-transparent px-3 py-2 font-mono text-[13px] text-white focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="my-production-app"
          />
        </div>

        <CopyBlock label="Node.js middleware" code={nodeSnippet} />
        <CopyBlock label="Python middleware" code={pythonSnippet} />

        <p className="font-mono text-[10px] text-[#6B7280]">
          Verify endpoint:{" "}
          <code className="text-[#D1FF00]">{verifyUrl}</code>
        </p>
      </div>
    </div>
  );
}
