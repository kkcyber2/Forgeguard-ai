"use client";

import * as React from "react";
import { useActionState } from "react";
import { Copy, Plus, Trash2, KeyRound, Check, Eye, EyeOff } from "lucide-react";
import { createApiKey, revokeApiKey } from "./api-key-actions";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface ApiKeysSectionProps {
  initialKeys: ApiKeyRow[];
}

interface CreateState {
  ok: boolean;
  error?: string;
  newKey?: string; // shown only once
  fieldErrors?: Record<string, string>;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function ApiKeysSection({ initialKeys }: ApiKeysSectionProps) {
  const [keys, setKeys] = React.useState<ApiKeyRow[]>(initialKeys);
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [showRaw, setShowRaw] = React.useState(false);
  const nameRef = React.useRef<HTMLInputElement>(null);

  const [createState, createAction, creating] = useActionState<CreateState, FormData>(
    async (_prev, formData) => {
      const result = await createApiKey(_prev, formData);
      if (result.ok && result.newKey) {
        setRevealedKey(result.newKey);
        // Optimistically add the key to the list (the server has already
        // created it — we just need a placeholder until next full reload).
        const name = formData.get("name") as string;
        const prefix = result.newKey.slice(0, 11); // fg_ + first 8 chars
        setKeys((prev) => [
          {
            id: crypto.randomUUID(),
            name,
            key_prefix: prefix,
            created_at: new Date().toISOString(),
            last_used_at: null,
            revoked_at: null,
          },
          ...prev,
        ]);
        if (nameRef.current) nameRef.current.value = "";
      }
      return result;
    },
    { ok: false },
  );

  const handleCopy = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (keyId: string) => {
    const fd = new FormData();
    fd.append("key_id", keyId);
    await revokeApiKey(fd);
    setKeys((prev) =>
      prev.map((k) =>
        k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k,
      ),
    );
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  return (
    <div className="space-y-5">
      {/* ── Newly generated key banner ────────────────────────────────────── */}
      {revealedKey && (
        <div className="rounded-sm border border-acid/30 bg-acid/5 p-4">
          <p className="mb-1 text-xs font-semibold text-acid">
            ✓ Key generated — copy it now. It will not be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded border border-white/[0.06] bg-obsidian px-3 py-2 font-mono text-xs text-foreground">
              {showRaw ? revealedKey : revealedKey.slice(0, 10) + "••••••••••••••••••••••••••••"}
            </code>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="shrink-0 rounded border border-white/[0.06] bg-surface p-2 text-foreground-subtle hover:text-foreground"
              title={showRaw ? "Hide" : "Reveal"}
            >
              {showRaw ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded border border-white/[0.06] bg-surface p-2 text-foreground-subtle hover:text-foreground"
              title="Copy to clipboard"
            >
              {copied ? <Check size={13} className="text-acid" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Create form ───────────────────────────────────────────────────── */}
      <form action={createAction} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] text-foreground-muted">
            Key name
          </label>
          <input
            ref={nameRef}
            name="name"
            placeholder="e.g. GitHub Actions / Deploy pipeline"
            required
            maxLength={80}
            className="w-full rounded-sm border-hairline border-white/[0.08] bg-surface px-3 py-2 font-mono text-xs text-foreground placeholder:text-foreground-subtle focus:border-acid/40 focus:outline-none focus:ring-1 focus:ring-acid/20"
          />
          {createState.fieldErrors?.name && (
            <p className="mt-1 text-[10px] text-threat">
              {createState.fieldErrors.name}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-1.5 rounded-sm border border-acid/40 bg-acid/10 px-3 py-2 text-xs font-medium text-acid transition-colors hover:bg-acid/15 disabled:opacity-50"
        >
          <Plus size={12} />
          {creating ? "Generating…" : "Generate key"}
        </button>
      </form>

      {createState.error && (
        <p className="text-xs text-threat">{createState.error}</p>
      )}

      {/* ── Active keys list ──────────────────────────────────────────────── */}
      {activeKeys.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {activeKeys.map((k) => (
            <KeyRow key={k.id} keyRow={k} onRevoke={handleRevoke} />
          ))}
        </div>
      )}

      {/* ── Revoked keys ─────────────────────────────────────────────────── */}
      {revokedKeys.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-foreground-subtle hover:text-foreground">
            {revokedKeys.length} revoked key{revokedKeys.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-2 opacity-50">
            {revokedKeys.map((k) => (
              <KeyRow key={k.id} keyRow={k} onRevoke={handleRevoke} disabled />
            ))}
          </div>
        </details>
      )}

      {/* ── Usage example ─────────────────────────────────────────────────── */}
      <div className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-subtle">
          GitHub Actions Example
        </p>
        <pre className="overflow-x-auto text-[10px] leading-relaxed text-foreground-muted">
{`- name: Trigger ForgeGuard scan
  run: |
    curl -s -X POST \\
      https://your-app.com/api/v1/scans \\
      -H "Authorization: Bearer $\{{ secrets.FORGEGUARD_KEY }}" \\
      -H "Content-Type: application/json" \\
      -d '{
        "target_model": "gpt-4o",
        "target_url": "$\{{ vars.AI_ENDPOINT }}",
        "api_key": "$\{{ secrets.AI_API_KEY }}",
        "notes": "Deploy #$\{{ github.run_number }}"
      }'`}
        </pre>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function KeyRow({
  keyRow,
  onRevoke,
  disabled,
}: {
  keyRow: ApiKeyRow;
  onRevoke: (id: string) => void;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = React.useState(false);

  const lastUsed = keyRow.last_used_at
    ? new Date(keyRow.last_used_at).toLocaleDateString()
    : "Never";

  const created = new Date(keyRow.created_at).toLocaleDateString();

  return (
    <div className="flex items-center justify-between rounded-sm border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <KeyRound size={12} className="shrink-0 text-foreground-subtle" />
        <div>
          <p className="text-xs font-medium text-foreground">{keyRow.name}</p>
          <p className="font-mono text-[10px] text-foreground-muted">
            {keyRow.key_prefix}••••••••
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden text-right sm:block">
          <p className="text-[10px] text-foreground-subtle">Created {created}</p>
          <p className="text-[10px] text-foreground-subtle">Last used {lastUsed}</p>
        </div>

        {!disabled && (
          confirming ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { onRevoke(keyRow.id); setConfirming(false); }}
                className="text-[10px] font-semibold text-threat hover:underline"
              >
                Revoke
              </button>
              <span className="text-foreground-subtle">/</span>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-[10px] text-foreground-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-foreground-subtle hover:text-threat"
              title="Revoke key"
            >
              <Trash2 size={12} />
            </button>
          )
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-sm border border-dashed border-white/[0.08] py-8 text-center">
      <KeyRound size={16} className="mx-auto mb-2 text-foreground-subtle" />
      <p className="text-xs text-foreground-muted">
        No API keys yet. Generate one above to enable CI/CD integration.
      </p>
    </div>
  );
}
