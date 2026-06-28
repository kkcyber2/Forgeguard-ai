-- 20260628_custom_attack_tools.sql
-- Operator-authored (developer) attack tools — engine-side foundation for the
-- Developer-role plugin SDK. Operators author small Python probes; an audit
-- pipeline approves them; the Agathon Brain invokes approved ones by name via
-- the run_operator_tool Brain tool, executing the code in the Docker sandbox.

create table if not exists public.custom_attack_tools (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  family          text not null default 'custom_tool',
  intensity_min   text not null default 'aggressive'
                  check (intensity_min in ('recon','standard','aggressive','greasy')),
  code            text not null,
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected','disabled')),
  audit_result    text,
  network_allowed boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (author_id, name)
);

create index if not exists custom_attack_tools_status_idx
  on public.custom_attack_tools (status);

alter table public.custom_attack_tools enable row level security;

-- Authors can read + manage their own tools.
create policy "custom_attack_tools author read"
  on public.custom_attack_tools for select
  to authenticated
  using (author_id = auth.uid());

create policy "custom_attack_tools author insert"
  on public.custom_attack_tools for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "custom_attack_tools author update"
  on public.custom_attack_tools for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "custom_attack_tools author delete"
  on public.custom_attack_tools for delete
  to authenticated
  using (author_id = auth.uid());

-- Sovereign/admin (access_level >= 5) can read all + approve/reject (update
-- status + audit_result) for the audit pipeline. They may NOT change code.
create policy "custom_attack_tools admin read all"
  on public.custom_attack_tools for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.access_level >= 5
    )
  );

create policy "custom_attack_tools admin audit"
  on public.custom_attack_tools for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.access_level >= 5
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.access_level >= 5
    )
  );

-- Bump updated_at automatically.
create or replace function public.bump_custom_attack_tools_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bump_custom_attack_tools on public.custom_attack_tools;
create trigger trg_bump_custom_attack_tools
  before update on public.custom_attack_tools
  for each row execute function public.bump_custom_attack_tools_updated_at();
