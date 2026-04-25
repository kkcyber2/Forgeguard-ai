-- ============================================================================
-- Agathon v1 schema additions
-- ============================================================================
-- Layered on top of the existing migration that ships profiles / scans /
-- scan_logs. Idempotent where reasonable. RLS is enforced on every table.
--
-- Apply in order:
--   1. Extensions and enums
--   2. Identity & billing
--   3. Engine extensions
--   4. Brain & custom tools
--   5. Reporting
--   6. RLS policies
--   7. Triggers & helpers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extensions & enums
-- ----------------------------------------------------------------------------

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

do $$ begin
  create type public.scan_intensity as enum ('recon', 'standard', 'aggressive', 'greasy');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.scan_surface_kind as enum ('llm', 'web', 'mobile', 'code');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.billing_plan as enum ('free', 'operator', 'red_team', 'enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum (
    'trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired','paused'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.usage_kind as enum (
    'compute_seconds','brain_input_tokens','brain_output_tokens','custom_tool_runs','scans'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tool_safety_status as enum ('approved','rejected','pending');
exception when duplicate_object then null; end $$;

-- Extend the existing scan_logs.type enum with Agathon event kinds.
-- (Postgres enum ALTER must be standalone; wrap in a guard so re-running is a no-op.)
do $$
begin
  if not exists (select 1 from pg_enum
                 where enumlabel = 'brain_decision'
                   and enumtypid = 'public.scan_log_type'::regtype) then
    alter type public.scan_log_type add value 'brain_decision';
  end if;
exception when undefined_object then
  -- The enum may live on the table's column without a named type; in that
  -- case the v1 migration created `scan_logs.type` as a check-constrained
  -- text column. Skip silently and let the application enforce.
  null;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum
                 where enumlabel = 'tool_run'
                   and enumtypid = 'public.scan_log_type'::regtype) then
    alter type public.scan_log_type add value 'tool_run';
  end if;
exception when undefined_object then null; end $$;

do $$
begin
  if not exists (select 1 from pg_enum
                 where enumlabel = 'tool_authored'
                   and enumtypid = 'public.scan_log_type'::regtype) then
    alter type public.scan_log_type add value 'tool_authored';
  end if;
exception when undefined_object then null; end $$;

do $$
begin
  if not exists (select 1 from pg_enum
                 where enumlabel = 'cost_event'
                   and enumtypid = 'public.scan_log_type'::regtype) then
    alter type public.scan_log_type add value 'cost_event';
  end if;
exception when undefined_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Identity & billing
-- ----------------------------------------------------------------------------

-- Extend profiles with billing pointers.
alter table public.profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists current_plan public.billing_plan not null default 'free',
  add column if not exists entitlements jsonb not null default '{}'::jsonb,
  add column if not exists scans_used_this_period int not null default 0,
  add column if not exists period_resets_at timestamptz;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id);

-- Subscriptions mirror Stripe so we don't round-trip on every quota check.
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  plan public.billing_plan not null,
  status public.subscription_status not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

create table if not exists public.payment_methods (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_pm_id text not null unique,
  brand text,
  last4 text,
  exp_month int,
  exp_year int,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists payment_methods_user_idx on public.payment_methods (user_id);

create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_invoice_id text not null unique,
  amount_paid_cents bigint not null default 0,
  amount_due_cents bigint not null default 0,
  currency text not null default 'usd',
  status text not null,                -- Stripe statuses are open-ended; keep as text
  hosted_invoice_url text,
  invoice_pdf_url text,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invoices_user_idx on public.invoices (user_id);
create index if not exists invoices_status_idx on public.invoices (status);

-- Metered billing source of truth. Aggregated nightly into Stripe meters.
create table if not exists public.usage_events (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid references public.scans (id) on delete set null,
  kind public.usage_kind not null,
  quantity numeric(20, 4) not null check (quantity >= 0),
  reported_to_stripe_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_kind_idx
  on public.usage_events (user_id, kind, created_at desc);
create index if not exists usage_events_unreported_idx
  on public.usage_events (kind, created_at)
  where reported_to_stripe_at is null;

-- ----------------------------------------------------------------------------
-- 3. Engine extensions
-- ----------------------------------------------------------------------------

alter table public.scans
  add column if not exists intensity public.scan_intensity not null default 'standard',
  add column if not exists surface_kind public.scan_surface_kind not null default 'llm',
  add column if not exists compute_seconds_used numeric(20, 4) not null default 0,
  add column if not exists brain_input_tokens_used bigint not null default 0,
  add column if not exists brain_output_tokens_used bigint not null default 0,
  add column if not exists custom_tools_count int not null default 0,
  add column if not exists report_id uuid;       -- back-pointer set after report is generated

create index if not exists scans_intensity_idx on public.scans (intensity);
create index if not exists scans_surface_idx on public.scans (surface_kind);

-- ----------------------------------------------------------------------------
-- 4. Brain transcripts & custom tools
-- ----------------------------------------------------------------------------

create table if not exists public.brain_transcripts (
  id bigserial primary key,
  scan_id uuid not null references public.scans (id) on delete cascade,
  turn_index int not null,
  role text not null check (role in ('system','user','assistant','tool')),
  content jsonb not null,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  cache_write_tokens int,
  latency_ms int,
  model text,
  created_at timestamptz not null default now(),
  unique (scan_id, turn_index)
);
create index if not exists brain_transcripts_scan_idx
  on public.brain_transcripts (scan_id, turn_index);

create table if not exists public.custom_tools (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  origin_scan_id uuid references public.scans (id) on delete set null,
  name text not null,
  description text,
  spec jsonb not null,                  -- {language, entrypoint, files, requires, max_runtime_s, needs_network, rationale}
  safety_status public.tool_safety_status not null default 'pending',
  safety_review jsonb,                  -- classifier output: flagged_imports, flagged_calls, decision_reason
  executions_count int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists custom_tools_user_idx on public.custom_tools (user_id);
create index if not exists custom_tools_status_idx on public.custom_tools (safety_status)
  where is_archived = false;

create table if not exists public.tool_executions (
  id bigserial primary key,
  tool_id uuid not null references public.custom_tools (id) on delete cascade,
  scan_id uuid references public.scans (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  exit_code int,
  duration_ms int,
  stdout_preview text,                  -- first 4 KB
  stderr_preview text,                  -- first 4 KB
  result jsonb,                         -- structured output if tool printed JSON
  sandbox_image text,
  sandbox_runtime_s int
);
create index if not exists tool_executions_tool_idx on public.tool_executions (tool_id, started_at desc);
create index if not exists tool_executions_scan_idx on public.tool_executions (scan_id, started_at desc);

-- ----------------------------------------------------------------------------
-- 5. Reporting
-- ----------------------------------------------------------------------------

create table if not exists public.scan_reports (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null unique references public.scans (id) on delete cascade,
  generated_at timestamptz not null default now(),
  generator_model text not null default 'llama-3.3-70b-versatile',

  -- Executive
  executive_summary_md text not null,
  cvss_overall numeric(3, 1) not null check (cvss_overall >= 0 and cvss_overall <= 10),
  risk_label text not null check (risk_label in ('NONE','LOW','MEDIUM','HIGH','CRITICAL')),

  -- Structured findings array; each item:
  -- { id, title, owasp_llm, cvss_vector, cvss_score, severity, description,
  --   reproduction_steps, payload, response_excerpt, exploitability_notes,
  --   remediation: { explanation, code_snippets:[{lang, label, code}], system_prompt_patch, test_case },
  --   tags:[], cwe:[] }
  findings jsonb not null default '[]'::jsonb,

  -- Sequential decisions for the timeline component
  attack_path jsonb not null default '[]'::jsonb,

  -- Performance / logic optimizations
  optimization_suggestions_md text,

  -- OWASP LLM Top 10 coverage matrix
  owasp_coverage jsonb,

  -- Persisted PDF (Supabase Storage path)
  pdf_storage_key text,

  -- Token accounting for the report itself
  generation_input_tokens int,
  generation_output_tokens int,
  generation_cost_usd numeric(10, 4)
);
create index if not exists scan_reports_scan_idx on public.scan_reports (scan_id);

-- Back-pointer from scans to reports (kept in sync by trigger below).
alter table public.scans
  add constraint scans_report_id_fkey
  foreign key (report_id) references public.scan_reports (id)
  on delete set null
  deferrable initially deferred;

-- ----------------------------------------------------------------------------
-- 6. RLS
-- ----------------------------------------------------------------------------

alter table public.subscriptions enable row level security;
alter table public.payment_methods enable row level security;
alter table public.invoices enable row level security;
alter table public.usage_events enable row level security;
alter table public.brain_transcripts enable row level security;
alter table public.custom_tools enable row level security;
alter table public.tool_executions enable row level security;
alter table public.scan_reports enable row level security;

-- Identity-scoped (user_id = auth.uid())
do $$ begin
  create policy "subscriptions_owner_read"
    on public.subscriptions for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "payment_methods_owner_read"
    on public.payment_methods for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "invoices_owner_read"
    on public.invoices for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "usage_events_owner_read"
    on public.usage_events for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "custom_tools_owner_read"
    on public.custom_tools for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "custom_tools_owner_write"
    on public.custom_tools for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Scan-scoped (joined via scans.user_id)
do $$ begin
  create policy "brain_transcripts_via_scan"
    on public.brain_transcripts for select using (
      scan_id in (select id from public.scans where user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tool_executions_via_scan"
    on public.tool_executions for select using (
      scan_id in (select id from public.scans where user_id = auth.uid())
      or tool_id in (select id from public.custom_tools where user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "scan_reports_via_scan"
    on public.scan_reports for select using (
      scan_id in (select id from public.scans where user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

-- Admin escape-hatch — uses the existing is_admin() SECURITY DEFINER fn.
do $$ begin
  create policy "subscriptions_admin_read"
    on public.subscriptions for select using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "invoices_admin_read"
    on public.invoices for select using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "usage_events_admin_read"
    on public.usage_events for select using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "custom_tools_admin_read"
    on public.custom_tools for select using (public.is_admin());
exception when duplicate_object then null; end $$;

-- Note: writes to all new tables happen through the service-role client
-- on Railway (orchestrator) or via the Stripe webhook on Vercel. RLS only
-- needs to gate user-facing reads.

-- ----------------------------------------------------------------------------
-- 7. Triggers & helpers
-- ----------------------------------------------------------------------------

-- Bump updated_at automatically.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$ begin
  create trigger subscriptions_touch
    before update on public.subscriptions
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger custom_tools_touch
    before update on public.custom_tools
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;

-- Sync scans.report_id when a report is inserted, so the dashboard can
-- one-shot fetch the report URL without a separate lookup.
create or replace function public.sync_scan_report_pointer()
returns trigger language plpgsql security definer as $$
begin
  update public.scans set report_id = new.id where id = new.scan_id;
  return new;
end $$;

do $$ begin
  create trigger scan_reports_sync_pointer
    after insert on public.scan_reports
    for each row execute function public.sync_scan_report_pointer();
exception when duplicate_object then null; end $$;

-- Helper: increment tool execution counter atomically.
create or replace function public.bump_tool_execution_count()
returns trigger language plpgsql security definer as $$
begin
  update public.custom_tools
    set executions_count = executions_count + 1
    where id = new.tool_id;
  return new;
end $$;

do $$ begin
  create trigger tool_executions_bump_count
    after insert on public.tool_executions
    for each row execute function public.bump_tool_execution_count();
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Grants for service-role writers (orchestrator + Stripe webhook)
-- ----------------------------------------------------------------------------

grant select, insert, update on
  public.subscriptions,
  public.payment_methods,
  public.invoices,
  public.usage_events,
  public.brain_transcripts,
  public.custom_tools,
  public.tool_executions,
  public.scan_reports
to service_role;

grant usage, select on all sequences in schema public to service_role;

-- End of migration.
