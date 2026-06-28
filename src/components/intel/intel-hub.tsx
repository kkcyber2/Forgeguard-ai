"use client";

/**
 * Intel Hub — Chat | Feed | Teams | Vault tabs (+ threat ticker).
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Globe,
  Heart,
  ImageIcon,
  MessageSquare,
  Send,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { IntelVaultPanel } from "@/components/intel/intel-vault-panel";
import { TrustTagBadge } from "@/components/trust/trust-tag-badge";
import { resolvePublicDisplayName } from "@/lib/access/ghost-mode";
import type { ExternalIntelItem } from "@/lib/live-map/external-intel";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  createPost,
  likePost,
  listFeed,
  type FeedPost,
} from "@/lib/social/feed-actions";
import {
  createTeam,
  inviteMember,
  listMyTeams,
  listTeamPosts,
  type TeamRow,
} from "@/lib/teams/team-actions";

type Tab = "chat" | "feed" | "teams" | "vault";

interface ChatMessage {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
}

function ThreatTicker({ items }: { items: ExternalIntelItem[] }) {
  if (items.length === 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-subtle">
        Threat ticker · advisories unavailable
      </p>
    );
  }

  return (
    <div className="overflow-hidden">
      <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-acid/70">
        CISA KEV · live advisories
      </p>
      <div className="flex gap-6 overflow-x-auto pb-1">
        {items.map((item) => (
          <span key={item.id} className="shrink-0 font-mono text-[10px] text-foreground-muted">
            <span className="text-acid">{item.id}</span> · {item.title}
          </span>
        ))}
      </div>
    </div>
  );
}

function CommunityChat() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [connected, setConnected] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
    void supabase
      .from("intel_messages_with_profile")
      .select("id, user_id, content, created_at, display_name")
      .order("created_at", { ascending: true })
      .limit(50)
      .then(async ({ data }) => {
        if (!data?.length) return;
        const userIds = Array.from(new Set(data.map((m) => m.user_id).filter((u): u is string => !!u)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, is_ghost_active, hacker_rank, full_name")
          .in("id", userIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
        setMessages(
          data.map((m) => {
            const prof = profileMap.get(m.user_id ?? "");
            return {
              ...m,
              id: String(m.id),
              display_name: resolvePublicDisplayName(
                m.user_id ?? "",
                m.display_name,
                prof?.is_ghost_active,
                prof?.hacker_rank,
              ),
            } as ChatMessage;
          }),
        );
      });
    const channel = supabase
      .channel("intel_messages:hub")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "intel_messages" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            content: string;
            created_at: string;
          };
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, is_ghost_active, hacker_rank")
            .eq("id", row.user_id)
            .maybeSingle();
          setMessages((prev) => [
            ...prev,
            {
              ...row,
              id: String(row.id),
              display_name: resolvePublicDisplayName(
                row.user_id,
                prof?.full_name,
                prof?.is_ghost_active,
                prof?.hacker_rank,
              ),
            },
          ]);
        },
      )
      .subscribe((s) => setConnected(s === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = input.trim();
    if (!body || !userId) return;
    setInput("");
    const supabase = createClient();
    await supabase.from("intel_messages").insert({ user_id: userId, content: body });
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <span className="font-mono text-xs uppercase tracking-wider text-foreground-subtle">
          Community Channel
        </span>
        <span className={cn("h-2 w-2 rounded-full", connected ? "bg-acid animate-pulse" : "bg-steel-700")} />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-mono text-[10px] text-acid">{m.display_name}</span>
            <p className="mt-0.5 text-foreground-muted">{m.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder="Share a finding or TTP…"
            className="min-h-[44px] flex-1 rounded-sm border border-white/[0.08] bg-black/30 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-acid/40"
            maxLength={500}
          />
          <button
            type="button"
            onClick={() => void send()}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-white/[0.1] hover:border-acid/40"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedPanel() {
  const [posts, setPosts] = React.useState<FeedPost[]>([]);
  const [content, setContent] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const rows = await listFeed(40);
    setPosts(rows);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Only images are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop()?.slice(0, 4) || "img";
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("social-posts")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      setMediaUrl(supabase.storage.from("social-posts").getPublicUrl(path).data.publicUrl);
    } catch (err) {
      console.error("[feed] media upload failed:", err);
      alert("Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (uploading) return;
    const r = await createPost({ content, mediaPath: mediaUrl });
    if (r.ok) {
      setContent("");
      setMediaUrl(null);
      void refresh();
    } else {
      alert(r.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-white/[0.08] bg-black/20 p-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Post to the operator feed…"
          rows={3}
          className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none"
          maxLength={2000}
        />
        {mediaUrl ? (
          <div className="relative mt-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt="attachment preview"
              className="max-h-48 rounded-sm border border-white/10 object-cover"
            />
            <button
              type="button"
              onClick={() => setMediaUrl(null)}
              className="absolute right-1 top-1 rounded-sm bg-black/70 px-2 py-0.5 text-[10px] uppercase text-threat"
            >
              Remove
            </button>
          </div>
        ) : null}
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => void onFileChange(e)}
            className="hidden"
            id="feed-media-input"
          />
          <label
            htmlFor="feed-media-input"
            className="inline-flex min-h-[44px] cursor-pointer items-center rounded-sm border border-white/10 px-3 text-xs uppercase tracking-wider text-foreground-subtle hover:text-foreground"
          >
            <ImageIcon size={14} className="mr-1.5" />
            {uploading ? "Uploading…" : "Image"}
          </label>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={uploading}
            className="inline-flex min-h-[44px] items-center rounded-sm border border-acid/30 bg-acid/10 px-4 text-xs uppercase tracking-wider text-acid disabled:opacity-40"
          >
            Publish
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-foreground-subtle">Loading feed…</p>
      ) : posts.length === 0 ? (
        <p className="text-xs text-foreground-subtle">No posts yet — be the first.</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li
              key={p.id}
              className="w-full rounded-sm border border-white/[0.06] bg-obsidian-800/40 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-acid">{p.author_name}</span>
                <TrustTagBadge
                  tag={p.author_company_tag}
                  tier={p.author_trust_tier}
                  verified={Boolean(p.author_company_tag)}
                />
                <span className="rounded-sm border border-white/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-foreground-subtle">
                  {p.rank_label}
                </span>
                <time className="ml-auto font-mono text-[10px] text-foreground-subtle">
                  {new Date(p.created_at).toLocaleString()}
                </time>
              </div>
              <p className="text-sm leading-relaxed text-foreground-muted">{p.content}</p>
              {p.media_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.media_path}
                  alt="post attachment"
                  className="mt-3 max-h-96 w-full rounded-sm border border-white/10 object-cover"
                />
              ) : null}
              <button
                type="button"
                onClick={() => void likePost(p.id).then(() => refresh())}
                className={cn(
                  "mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-sm border px-3 text-xs",
                  p.liked_by_me ? "border-acid/40 text-acid" : "border-white/10 text-foreground-subtle",
                )}
              >
                <Heart size={14} className={p.liked_by_me ? "fill-current" : ""} />
                {p.like_count}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamsPanel() {
  const [teams, setTeams] = React.useState<TeamRow[]>([]);
  const [name, setName] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [teamPosts, setTeamPosts] = React.useState<FeedPost[]>([]);
  const [postBody, setPostBody] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");

  const refreshTeams = React.useCallback(async () => {
    setTeams(await listMyTeams());
  }, []);

  React.useEffect(() => {
    void refreshTeams();
  }, [refreshTeams]);

  React.useEffect(() => {
    if (!selected) {
      setTeamPosts([]);
      return;
    }
    void listTeamPosts(selected).then(setTeamPosts);
  }, [selected]);

  async function create() {
    const r = await createTeam(name);
    if (r.ok) {
      setName("");
      await refreshTeams();
      setSelected(r.id);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New team name"
            className="min-h-[44px] flex-1 rounded-sm border border-white/[0.08] bg-black/30 px-3 text-xs"
          />
          <button
            type="button"
            onClick={() => void create()}
            className="min-h-[44px] rounded-sm border border-acid/30 px-4 text-xs uppercase text-acid"
          >
            Create
          </button>
        </div>
        <ul className="space-y-2">
          {teams.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelected(t.id)}
                className={cn(
                  "flex w-full min-h-[44px] items-center justify-between rounded-sm border px-3 py-2 text-left text-sm",
                  selected === t.id ? "border-acid/40 bg-acid/5" : "border-white/[0.06]",
                )}
              >
                <span>{t.name}</span>
                <Users size={14} className="text-foreground-subtle" />
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <div className="flex gap-2">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Invite email"
              className="min-h-[44px] flex-1 rounded-sm border border-white/[0.08] bg-black/30 px-3 text-xs"
            />
            <button
              type="button"
              onClick={() =>
                void inviteMember(selected, inviteEmail).then((r) => {
                  if (r.ok) setInviteEmail("");
                })
              }
              className="min-h-[44px] rounded-sm border border-white/10 px-3 text-xs"
            >
              Invite
            </button>
          </div>
        )}
      </div>
      <div>
        {selected ? (
          <>
            <p className="mb-2 font-mono text-[10px] uppercase text-foreground-subtle">Team feed</p>
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              placeholder="Team-only post…"
              className="mb-2 w-full rounded-sm border border-white/[0.08] bg-black/30 p-3 text-xs"
              rows={2}
            />
            <button
              type="button"
              onClick={() =>
                void createPost({
                  content: postBody,
                  teamId: selected,
                  visibility: "team",
                }).then(() => {
                  setPostBody("");
                  void listTeamPosts(selected).then(setTeamPosts);
                })
              }
              className="mb-4 min-h-[44px] rounded-sm border border-acid/30 px-4 text-xs text-acid"
            >
              Post to team
            </button>
            <ul className="space-y-2">
              {teamPosts.map((p) => (
                <li key={p.id} className="rounded-sm border border-white/[0.06] p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-acid">{p.author_name}</span>
                    <TrustTagBadge
                      tag={p.author_company_tag}
                      tier={p.author_trust_tier}
                      verified={Boolean(p.author_company_tag)}
                      size="md"
                    />
                  </div>
                  <p className="mt-1 text-foreground-muted">{p.content}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-foreground-subtle">Select or create a team.</p>
        )}
      </div>
    </div>
  );
}

export function IntelHub({ tickerItems = [] }: { tickerItems?: ExternalIntelItem[] }) {
  const reduce = useReducedMotion();
  const [tab, setTab] = React.useState<Tab>("chat");

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "feed", label: "Feed", icon: Zap },
    { id: "teams", label: "Teams", icon: Users },
    { id: "vault", label: "Intel Vault", icon: Shield },
  ];

  return (
    <div className="flex flex-col gap-0 pb-12 -mx-6 -mt-6">
      <div className="border-b border-white/[0.05] bg-obsidian-950/60 py-2 px-4">
        <ThreatTicker items={tickerItems} />
      </div>

      <div className="px-6 pt-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-acid" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-acid">
              Intelligence Hub
            </span>
          </div>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Community Threat Intelligence</h1>
        </motion.div>

        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-2 rounded-sm border px-4 text-xs uppercase tracking-wider",
                tab === id ? "border-acid/40 bg-acid/10 text-acid" : "border-white/[0.08] text-foreground-subtle",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-sm border border-white/[0.06] bg-obsidian-800/40 p-4 md:p-5 min-h-[480px]">
          {tab === "chat" && <CommunityChat />}
          {tab === "feed" && <FeedPanel />}
          {tab === "teams" && <TeamsPanel />}
          {tab === "vault" && <IntelVaultPanel />}
        </div>
      </div>
    </div>
  );
}
