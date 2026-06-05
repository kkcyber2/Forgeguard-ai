"use client";

import * as React from "react";
import { Check, Copy, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { defaultAegisAppId } from "@/lib/aegis/shield-rules";
import { createClient } from "@/lib/supabase/client";

function useAppOrigin() {
  const [origin, setOrigin] = React.useState("https://www.forgeguard-ai.com");
  React.useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);
  return origin;
}

type SnippetLang = "node" | "python";

export function SovereignProxyConfig() {
  const origin = useAppOrigin();
  const [appId, setAppId] = React.useState("my-app-id");
  const [userId, setUserId] = React.useState<string | null>(null);
  const [lang, setLang] = React.useState<SnippetLang>("node");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        setAppId(defaultAegisAppId(user.id));
      }
    });
  }, []);

  const verifyUrl = `${origin}/api/v1/aegis/verify`;
  const userIdLine = userId ? `\nconst AEGIS_USER_ID = "${userId}";` : "";
  const userIdJson = userId ? '\n      userId: AEGIS_USER_ID,' : "";

  const nodeSnippet = `// SOVEREIGN PROXY CONFIG — Node.js / Express
const AEGIS_VERIFY_URL = "${verifyUrl}";
const AEGIS_APP_ID = "${appId}";${userIdLine}

export async function aegisVerifyPrompt(prompt) {
  const res = await fetch(AEGIS_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: String(prompt),
      appId: AEGIS_APP_ID,${userIdJson}
    }),
  });
  if (!res.ok) return false;
  return Boolean((await res.json()).allowed);
}

export function aegisMiddleware() {
  return async (req, res, next) => {
    const prompt =
      req.body?.prompt ??
      req.body?.input ??
      req.body?.messages?.slice(-1)?.[0]?.content;
    if (!prompt) return next();
    if (!(await aegisVerifyPrompt(prompt))) {
      return res.status(403).json({ error: "Blocked by ForgeGuard Aegis Shield" });
    }
    next();
  };
}`;

  const pythonSnippet = `# SOVEREIGN PROXY CONFIG — Python / FastAPI
import httpx

AEGIS_VERIFY_URL = "${verifyUrl}"
AEGIS_APP_ID = "${appId}"${userId ? `\nAEGIS_USER_ID = "${userId}"` : ""}

async def aegis_verify_prompt(prompt: str) -> bool:
    payload = {"prompt": str(prompt), "appId": AEGIS_APP_ID${
      userId ? ', "userId": AEGIS_USER_ID' : ""
    }}
    async with httpx.AsyncClient(timeout=2.0) as client:
        resp = await client.post(AEGIS_VERIFY_URL, json=payload)
        if resp.status_code >= 400:
            return False
        return bool(resp.json().get("allowed", False))

# FastAPI dependency example:
# if not await aegis_verify_prompt(user_prompt):
#     raise HTTPException(403, "Blocked by Aegis Shield")`;

  const activeCode = lang === "node" ? nodeSnippet : pythonSnippet;

  const copy = async () => {
    await navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-sm border border-acid/35",
        "bg-[#030303] p-5 shadow-[0_0_48px_rgba(209,255,0,0.08)]",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(209,255,0,0.07),transparent_55%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Shield size={14} strokeWidth={1.5} className="text-acid" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-acid">
              Sovereign Proxy Config
            </span>
          </div>
          <p className="max-w-xl text-[12px] leading-relaxed text-foreground-muted">
            Copy-paste middleware for Node.js or Python — forwards user input to{" "}
            <code className="font-mono text-[11px] text-acid/90">{verifyUrl}</code>{" "}
            and blocks vectors sealed in{" "}
            <code className="font-mono text-[11px] text-foreground-subtle">aegis_shield_rules</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xs border px-3 py-1.5",
            "border-acid/30 bg-acid/[0.06] font-mono text-[10px] uppercase tracking-[0.12em] text-acid",
            "hover:bg-acid/[0.12] transition-colors",
          )}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy block"}
        </button>
      </div>

      <div className="relative mt-4 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground-subtle">
            App ID (aegis_shield_rules.app_id)
          </label>
          <input
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            className={cn(
              "w-full max-w-md rounded-xs border border-white/[0.08] bg-black/60",
              "px-3 py-2 font-mono text-[12px] text-acid focus:border-acid/40 focus:outline-none",
            )}
          />
        </div>
        <div className="flex gap-1 rounded-xs border border-white/[0.08] p-0.5">
          {(["node", "python"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setLang(id)}
              className={cn(
                "rounded-xs px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                lang === id
                  ? "bg-acid/15 text-acid"
                  : "text-foreground-subtle hover:text-foreground-muted",
              )}
            >
              {id === "node" ? "Node.js" : "Python"}
            </button>
          ))}
        </div>
      </div>

      <pre
        className={cn(
          "relative mt-4 max-h-[420px] overflow-auto p-4",
          "font-mono text-[11px] leading-[1.55] text-[#c8ff4d]",
          "border border-acid/20 bg-black/80",
          "shadow-[inset_0_0_32px_rgba(209,255,0,0.04)]",
        )}
      >
        {activeCode}
      </pre>
    </section>
  );
}
