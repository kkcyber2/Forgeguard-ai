"use client";

import * as React from "react";
import { Lock, Unlock, KeyRound, Send } from "lucide-react";
import { createPost } from "@/lib/social/feed-actions";
import {
  deriveChannelKey,
  encryptMessage,
  decryptMessage,
  isEncrypted,
  loadTeamPassphrase,
  storeTeamPassphrase,
  clearTeamPassphrase,
} from "@/lib/e2ee/team-channel-crypto";
import { cn } from "@/lib/utils";

interface Props {
  teamId: string;
  posts: Array<{ id: string; content: string; created_at: string; author_name: string }>;
  onRefresh: () => void;
}

/** Team-scoped E2EE channel in Intel Hub Teams tab. */
export function TeamE2eeChannel({ teamId, posts, onRefresh }: Props) {
  const [passphrase, setPassphrase] = React.useState("");
  const [channelKey, setChannelKey] = React.useState<CryptoKey | null>(null);
  const [body, setBody] = React.useState("");
  const [decrypted, setDecrypted] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const stored = loadTeamPassphrase(teamId);
    if (stored) {
      setPassphrase(stored);
      void deriveChannelKey(stored, teamId).then(setChannelKey).catch(() => {});
    }
  }, [teamId]);

  React.useEffect(() => {
    if (!channelKey) return;
    void (async () => {
      const next: Record<string, string> = {};
      for (const p of posts) {
        if (isEncrypted(p.content)) {
          try {
            next[p.id] = await decryptMessage(p.content, channelKey);
          } catch {
            next[p.id] = "[encrypted]";
          }
        } else {
          next[p.id] = p.content;
        }
      }
      setDecrypted(next);
    })();
  }, [channelKey, posts]);

  async function unlock() {
    const key = await deriveChannelKey(passphrase, teamId);
    storeTeamPassphrase(teamId, passphrase);
    setChannelKey(key);
  }

  async function send() {
    if (!channelKey || !body.trim()) return;
    const ciphertext = await encryptMessage(body.trim(), channelKey);
    const r = await createPost({ content: ciphertext, teamId, visibility: "team" });
    if (r.ok) {
      setBody("");
      onRefresh();
    }
  }

  return (
    <div className="mt-4 rounded-sm border border-white/[0.06] p-4">
      <div className="flex items-center gap-2">
        {channelKey ? (
          <Unlock size={14} className="text-acid" />
        ) : (
          <Lock size={14} className="text-foreground-subtle" />
        )}
        <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-subtle">
          Team E2EE channel
        </p>
        {channelKey && (
          <button
            type="button"
            onClick={() => {
              clearTeamPassphrase(teamId);
              setChannelKey(null);
              setPassphrase("");
            }}
            className="ml-auto text-[10px] uppercase text-foreground-subtle hover:text-foreground"
          >
            Lock
          </button>
        )}
      </div>

      {!channelKey ? (
        <div className="mt-3 flex gap-2">
          <input
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Shared team passphrase"
            type="password"
            className="min-h-[44px] flex-1 rounded-sm border border-white/[0.08] bg-black/30 px-3 text-xs"
          />
          <button
            type="button"
            onClick={() => void unlock()}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-sm border border-acid/30 px-3 text-xs uppercase text-acid"
          >
            <KeyRound size={12} />
            Unlock
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
            {posts.map((p) => (
              <li key={p.id}>
                <span className="font-mono text-[10px] text-acid">{p.author_name}</span>
                <p className="text-foreground-muted">{decrypted[p.id] ?? "…"}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void send()}
              placeholder="Encrypted team message…"
              className="min-h-[44px] flex-1 rounded-sm border border-white/[0.08] bg-black/30 px-3 text-xs"
            />
            <button
              type="button"
              onClick={() => void send()}
              className={cn(
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border",
                "border-acid/30 hover:bg-acid/10",
              )}
              aria-label="Send encrypted"
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
