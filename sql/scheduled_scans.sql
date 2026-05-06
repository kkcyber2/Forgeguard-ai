-- ─────────────────────────────────────────────────────────────────────────────
-- scheduled_scans
-- ─────────────────────────────────────────────────────────────────────────────
-- Persists recurring scan configurations. A Supabase Edge Function
-- (run-scheduled-scans) runs on a pg_cron schedule and:
--   1. Selects rows where next_run_at <= now() AND active = true
--   2. Inserts a new scan row (copying target_* and credential)
--   3. Updates last_run_at and next_run_at
--
-- Frequencies
-- ───────────
--   'daily'   → next_run_at += interval '1 day'
--   'weekly'  → next_run_at += interval '7 days'
--   'monthly' → next_run_at += interval '30 days'
-- ─────────────────────────────────────────────────────────────────────────────

create type scheduled_scan_frequency as enum ('daily', 'weekly', 'monthly');

create table if not exists public.scheduled_scans (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users (id) on delete cascade,
  name                        text not null,                   -- human label
  target_model                text not null,
  target_url                  text not null,
  target_credential_encrypted text not null,                   -- sealed with sealCredential()
  frequency                   scheduled_scan_frequency not null default 'weekly',
  active                      boolean not null default true,
  last_run_at                 timestamptz,
  next_run_at                 timestamptz not null,            -- set by UI on creation
  created_at                  timestamptz not null default now()
);

-- The cron job scans this index every minute
create index if not exists scheduled_scans_due_idx
  on public.scheduled_scans (next_run_at)
  where active = true;

create index if not exists scheduled_scans_user_idx
  on public.scheduled_scans (user_id, created_at desc);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.scheduled_scans enable row level security;

create policy "users manage own schedules"
  on public.scheduled_scans
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Comments ──────────────────────────────────────────────────────────────────
comment on table  public.scheduled_scans is 'Recurring scan configurations, driven by pg_cron + Edge Function';
comment on column public.scheduled_scans.target_credential_encrypted is 'AES-GCM sealed copy of the target API key, same scheme as scans table';
comment on column public.scheduled_scans.next_run_at is 'When the next scan should fire; updated by the cron runner after each run';

-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron setup (run once with superuser / postgres role)
-- ─────────────────────────────────────────────────────────────────────────────
-- Uncomment and run this in the Supabase SQL editor (not in migrations,
-- because pg_cron extension must be enabled first via Dashboard → Extensions):
--
-- select cron.schedule(
--   'run-scheduled-scans',
--   '* * * * *',   -- every minute; the function is idempotent when nothing is due
--   $$
--     select net.http_post(
--       url := current_setting('app.settings.supabase_url') || '/functions/v1/run-scheduled-scans',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--       ),
--       body := '{}'
--     );
--   $$
-- );
