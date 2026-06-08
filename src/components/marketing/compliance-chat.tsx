"use client";

import * as React from "react";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function ComplianceChatBubble() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I'm the ForgeGuard Compliance Expert. Ask me about adversarial risk, $ALE liability, or how our scans protect your LLM endpoints.",
    },
  ]);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/support/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setMessages([
        ...next,
        {
          role: "assistant",
          content: data.reply ?? data.error ?? "No response from compliance expert.",
        },
      ]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Network error — please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-sm border border-acid/30 bg-obsidian-950/95 shadow-[0_0_40px_rgba(209,255,0,0.12)] backdrop-blur-md"
          role="dialog"
          aria-label="ForgeGuard compliance chat"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-acid">
                Sovereign AI Support
              </p>
              <p className="text-xs text-white/60">Compliance Expert · DeepSeek-V3</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/40 hover:text-white"
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </div>
          <div ref={scrollRef} className="max-h-72 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-sm px-3 py-2 text-xs leading-relaxed",
                  m.role === "user"
                    ? "ml-6 bg-acid/10 text-acid"
                    : "mr-4 bg-white/5 text-white/75",
                )}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-white/40">
                <Loader2 size={12} className="animate-spin" />
                Analyzing risk posture…
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t border-white/10 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Ask about $ALE, jailbreaks, compliance…"
              className="flex-1 rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-acid/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="rounded-sm bg-acid px-3 py-2 text-obsidian disabled:opacity-40"
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-acid/40 bg-acid text-obsidian shadow-[0_0_24px_rgba(209,255,0,0.35)] transition-transform hover:scale-105"
        aria-label={open ? "Close compliance chat" : "Open compliance chat"}
      >
        <MessageCircle size={22} strokeWidth={1.75} />
      </button>
    </>
  );
}
