-- ============================================================
-- Sprint 13: Marine Machine
-- terminal_inputs · recon_targets · repo_files · bazaar patch
-- ============================================================

-- ── terminal_inputs ──────────────────────────────────────────
create table if not exists terminal_inputs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  session_id  text        not null,
  content     text        not null,
  consumed    boolean     not null default false,
  created_at  timestamptz not null default now()
);

alter table terminal_inputs enable row level security;

create policy "terminal_inputs: owner full access"
  on terminal_inputs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists terminal_inputs_session_idx
  on terminal_inputs (session_id, consumed, created_at);

-- ── recon_targets ─────────────────────────────────────────────
create table if not exists recon_targets (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  target       text        not null,
  status       text        not null default 'queued'
                           check (status in ('queued','running','done','failed')),
  surface_map  jsonb,
  scan_depth   int         not null default 1,
  started_at   timestamptz,
  completed_at timestamptz,
  error_msg    text,
  created_at   timestamptz not null default now()
);

alter table recon_targets enable row level security;

create policy "recon_targets: owner full access"
  on recon_targets for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists recon_targets_user_idx
  on recon_targets (user_id, created_at desc);

-- ── repo_files ────────────────────────────────────────────────
create table if not exists repo_files (
  id           uuid        primary key default gen_random_uuid(),
  repo_id      uuid        not null references repos(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  path         text        not null,
  name         text        not null,
  size_bytes   int         not null default 0,
  mime_type    text        not null default 'text/plain',
  storage_key  text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (repo_id, path)
);

alter table repo_files enable row level security;

create policy "repo_files: owner full access"
  on repo_files for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists repo_files_repo_idx
  on repo_files (repo_id, path);

-- ── bazaar_scripts: add audit_verdict if missing ──────────────
do $$ begin
  if not exists (
    select 1 from information_schema.columns
     where table_name  = 'bazaar_scripts'
       and column_name = 'audit_verdict'
  ) then
    alter table bazaar_scripts
      add column audit_verdict text
        check (audit_verdict in ('pending_audit','cleared','rejected'))
        default 'pending_audit';
  end if;
end $$;

-- Supabase Storage: bucket must be created via dashboard or CLI
-- CREATE BUCKET "hacker-repos" (private, 50MB file limit)
-- Storage policy: authenticated users can read/write their own prefix {user.id}/**
