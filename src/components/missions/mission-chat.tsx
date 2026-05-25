"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Send, Loader2 } from "lucide-react";
import { OperatorNameBadge } from "@/components/dashboard/verified-badge";
import { normalizeHackerRankLabel, rankBadgeClass } from "@/lib/access/ranks";
import { operatorAlias } from "@/lib/access/ghost-mode";
import { cn } from "@/lib/utils";
import { sendMissionMessage } from "./actions";

interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  isOwn: boolean;
}

interface SenderMeta {
  fullName: string | null;
  hackerRank: string | number;
  identityVerified: boolean;
  companyTag: string | null;
  domainVerified: boolean;
  isGhostActive?: boolean;
}

interface Props {
  missionId: string;
  currentUserId: string;
  initialMessages: Message[];
  initialSenders?: Record<string, SenderMeta>;
}

export function MissionChat({
  missionId,
  currentUserId,
  initialMessages,
  initialSenders = {},
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [senders, setSenders] = useState<Record<string, SenderMeta>>(initialSenders);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  const loadSender = useCallback(
    async (senderId: string) => {
      if (senders[senderId]) return;
      const { data } = await supabase
        .from("profiles")
        .select(
          "full_name, hacker_rank, identity_verified, company_tag, domain_verified, is_ghost_active",
        )
        .eq("id", senderId)
        .maybeSingle();
      if (!data) return;
      setSenders((prev) => ({
        ...prev,
        [senderId]: {
          fullName: data.is_ghost_active
            ? operatorAlias(senderId)
            : data.full_name,
          hackerRank: data.hacker_rank ?? "RECRUIT",
          identityVerified: data.identity_verified ?? false,
          companyTag: data.company_tag,
          domainVerified: data.domain_verified ?? false,
          isGhostActive: data.is_ghost_active ?? false,
        },
      }));
    },
    [senders, supabase],
  );

  useEffect(() => {
    const channel = supabase
      .channel(`mission-chat-${missionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mission_messages",
          filter: `mission_id=eq.${missionId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string;
            body: string;
            created_at: string;
          };
          void loadSender(row.sender_id);
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                senderId: row.sender_id,
                body: row.body,
                createdAt: row.created_at,
                isOwn: row.sender_id === currentUserId,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [missionId, currentUserId, loadSender, supabase]);

  useEffect(() => {
    for (const m of messages) void loadSender(m.senderId);
  }, [messages, loadSender]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const body = input.trim();
    if (!body) return;
    setInput("");
    startTransition(async () => {
      await sendMissionMessage({ missionId, body });
    });
  }

  return (
    <div
      className="flex flex-col rounded-[4px] overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
        border: "0.5px solid rgba(255,255,255,0.09)",
        height: 420,
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#D1FF00]">
          Mission Chat · Realtime
        </p>
        <span className="flex items-center gap-1 text-[10px] text-white/25">
          <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse bg-[#D1FF00]" />
          Live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <p className="text-center font-mono text-[10px] text-white/25 mt-8">
            No messages yet. Start the secure channel.
          </p>
        )}
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            meta={senders[msg.senderId]}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-2.5 border-t border-white/[0.06]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Send encrypted message…"
          className="flex-1 rounded-[3px] border-[0.5px] border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] text-white outline-none focus:border-[#D1FF00]/35"
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-[#D1FF00] text-[#050505] disabled:opacity-30"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </form>
    </div>
  );
}

function ChatBubble({
  message,
  meta,
}: {
  message: Message;
  meta?: SenderMeta;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const rank = normalizeHackerRankLabel(meta?.hackerRank);
  const label = message.isOwn
    ? "YOU"
    : meta?.isGhostActive
      ? operatorAlias(message.senderId)
      : meta?.fullName ?? `OP:${message.senderId.slice(0, 6)}`;

  return (
    <div className={cn("flex flex-col gap-1", message.isOwn ? "items-end" : "items-start")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded-[2px] border-[0.5px] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em]",
            rankBadgeClass(meta?.hackerRank ?? null),
          )}
        >
          {rank}
        </span>
        <OperatorNameBadge
          name={label}
          identityVerified={meta?.identityVerified}
          companyTag={meta?.companyTag}
          domainVerified={meta?.domainVerified}
        />
        <span className="font-mono text-[9px] text-white/20">{time}</span>
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-[3px] border-[0.5px] px-3 py-2 font-mono text-[11px] leading-relaxed",
          message.isOwn
            ? "border-[#D1FF00]/25 bg-[#D1FF00]/[0.08] text-white/90"
            : "border-white/10 bg-white/[0.04] text-white/75",
        )}
      >
        {message.body}
      </div>
    </div>
  );
}
