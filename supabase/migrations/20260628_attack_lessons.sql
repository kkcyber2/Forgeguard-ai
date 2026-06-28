-- 20260628_attack_lessons.sql
-- EVOLVE_SYSTEM cross-scan lesson ledger.
-- Aggregates per (provider, model, family) so future scans of the same target
-- class start with knowledge of what failed / breached last time. Written by
-- the Agathon engine via the service role; read by the engine at scan start.

create table if not exists public.attack_lessons (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  model         text not null,
  family        text not null,
  lesson_text   text not null,
  breach_count  integer not null default 0,
  fail_count    integer not null default 0,
  last_seen_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint attack_lessons_target_unique unique (provider, model, family)
);

-- Fast lookup by target class.
create index if not exists attack_lessons_target_idx
  on public.attack_lessons (provider, model, updated_at desc);

alter table public.attack_lessons enable row level security;

-- The engine writes/reads via the service role (bypasses RLS).
-- Sovereign/admin operators can read the ledger for observability; no PII is
-- stored (only provider/model/family/counts/lesson text).
create policy "attack_lessons admin read"
  on public.attack_lessons for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.access_level >= 5
    )
  );

-- Bump updated_at automatically.
create or replace function public.bump_attack_lessons_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bump_attack_lessons on public.attack_lessons;
create trigger trg_bump_attack_lessons
  before update on public.attack_lessons
  for each row execute function public.bump_attack_lessons_updated_at();
