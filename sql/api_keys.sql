-- ─────────────────────────────────────────────────────────────────────────────
-- user_api_keys
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores hashed API keys for programmatic / CI-CD access.
-- The raw key (fg_<32-random-hex>) is shown to the user exactly once; only
-- the SHA-256 hash is persisted here.
--
-- Flow:
--   1. User generates a key via the dashboard UI.
--   2. Frontend calls the /api/v1/keys POST Server Action.
--   3. Server generates a cryptographically random key, hashes it with
--      SHA-256, stores the hash here, and returns the raw key once.
--   4. CI/CD tool sends: Authorization: Bearer fg_<raw_key>
--   5. /api/v1/scans route hashes the incoming token and looks up the row.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_api_keys (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,                  -- human-readable label
  key_prefix      text not null,                  -- first 8 chars, shown in UI (fg_a1b2c3d4…)
  key_hash        text not null unique,           -- SHA-256 hex of the full key
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  revoked_at      timestamptz
);

-- Fast lookup on hash (hot path for every API request)
create index if not exists user_api_keys_hash_idx
  on public.user_api_keys (key_hash)
  where revoked_at is null;

-- List all keys for a user (dashboard UI)
create index if not exists user_api_keys_user_idx
  on public.user_api_keys (user_id, created_at desc);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.user_api_keys enable row level security;

-- Users can only see their own keys
create policy "users see own keys"
  on public.user_api_keys for select
  using (auth.uid() = user_id);

-- Users can create their own keys (creation goes via server action, but RLS
-- must allow the insert when using the session-bound supabase client)
create policy "users create own keys"
  on public.user_api_keys for insert
  with check (auth.uid() = user_id);

-- Users can revoke (update) their own keys
create policy "users revoke own keys"
  on public.user_api_keys for update
  using (auth.uid() = user_id);

-- Deletion is disallowed — soft-revoke via revoked_at instead
-- (no delete policy)

-- ── Comments ──────────────────────────────────────────────────────────────────
comment on table  public.user_api_keys is 'Hashed API keys for programmatic/CI-CD access';
comment on column public.user_api_keys.key_prefix  is 'First 8 chars of raw key for UI display (e.g. fg_a1b2c3)';
comment on column public.user_api_keys.key_hash    is 'SHA-256 hex of the full raw key — never store the raw key';
comment on column public.user_api_keys.revoked_at  is 'Set to revoke; NULL means active';
