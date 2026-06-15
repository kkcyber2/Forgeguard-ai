-- LAUNCH_ALL.sql — ForgeGuard AI idempotent schema bootstrap
-- Project: nlginrukltrwpkyujzzx (ForgeGuard-ai)
-- Run ONCE in Supabase SQL Editor. Do not apply via CI without review.
-- Generated: 2026-06-13 20:24:21


-- ========== 0002_agathon_schema.sql ==========

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

-- Admin escape-hatch â€” uses the existing is_admin() SECURITY DEFINER fn.
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

-- ========== 0003_audit_enhancements.sql ==========

-- ============================================================
-- Migration 0003: Audit Report Enhancements
-- ============================================================
-- 1. Add full Markdown audit report column to scan_reports
-- 2. Add indirect_prompt_injection OWASP family note (comment)
-- 3. Add subscriptions table for LemonSqueezy payment gating
-- ============================================================

-- â”€â”€ 1. audit_report_md on scan_reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Full structured Markdown report built by agathon/reporter.py at seal time.
-- Rendered in the dashboard using a rich Markdown renderer (findings-report.tsx).
alter table public.scan_reports
  add column if not exists audit_report_md text;

-- â”€â”€ 2. subscriptions table (LemonSqueezy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Stores the current active subscription for each user.
-- plan: 'free' | 'startup' | 'enterprise'
-- status: mirrors LemonSqueezy subscription status values
-- scans_used_this_period: rolling counter reset each billing cycle
-- period_ends_at: when the current billing period ends (for scan limit resets)

create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users (id) on delete cascade,

  -- Plan identity
  plan text not null default 'free'
    check (plan in ('free', 'startup', 'enterprise')),

  -- LemonSqueezy IDs
  ls_subscription_id text,          -- "sub_xxxxxxx"
  ls_customer_id text,               -- "cus_xxxxxxx"
  ls_variant_id text,                -- variant that maps to the plan
  ls_order_id text,                  -- initial order ID

  -- Subscription lifecycle
  status text not null default 'active'
    check (status in ('active', 'paused', 'past_due', 'cancelled', 'expired', 'on_trial')),

  -- Scan quota tracking
  scans_used_this_period integer not null default 0,
  period_starts_at timestamptz not null default now(),
  period_ends_at timestamptz,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.subscriptions enable row level security;

-- Users can read their own subscription.
create policy "subscriptions_self_read"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Only the service-role key (webhook handler) may insert/update.
-- Client-side writes are blocked â€” all mutations go through the webhook.
create policy "subscriptions_service_write"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

-- â”€â”€ 3. Ensure every new user gets a free plan row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Fired by Supabase Auth on user creation.
create or replace function public.handle_new_user_subscription()
returns trigger language plpgsql security definer as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Drop if exists first (idempotent re-runs)
drop trigger if exists on_auth_user_created_subscription on auth.users;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute procedure public.handle_new_user_subscription();

-- â”€â”€ 4. Scan-limit helper view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Returns the scan quota for the calling user. The Next.js route reads this
-- before allowing a new scan to start.

create or replace view public.my_scan_quota as
select
  s.user_id,
  s.plan,
  s.status,
  s.scans_used_this_period,
  case s.plan
    when 'free'       then 2
    when 'startup'    then 20
    when 'enterprise' then 999999
    else 2
  end as scans_allowed,
  s.period_ends_at,
  now() > coalesce(s.period_ends_at, now() + interval '1 year') as period_expired
from public.subscriptions s
where s.user_id = auth.uid();

-- â”€â”€ Index for webhook lookups by LS subscription ID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create index if not exists subscriptions_ls_id_idx
  on public.subscriptions (ls_subscription_id)
  where ls_subscription_id is not null;

-- ========== 20260516_promo_codes.sql ==========

-- =============================================================================
-- ForgeGuard AI â€” Promo Code Redemption System
-- Run this in Supabase SQL Editor â†’ New query â†’ Run
-- =============================================================================

-- â”€â”€ Tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text        UNIQUE NOT NULL,
  reward_type    text        NOT NULL DEFAULT 'plan_upgrade',
  target_plan    text        NOT NULL CHECK (target_plan IN ('startup', 'enterprise')),
  scans_to_add   integer     NOT NULL DEFAULT 1,
  uses_left      integer     NOT NULL DEFAULT 1,
  expires_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.redeemed_codes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id      uuid        NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code_id, user_id)   -- hard block on double-redemption
);

-- â”€â”€ Row-Level Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.promo_codes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeemed_codes ENABLE ROW LEVEL SECURITY;

-- Admins have full access to promo_codes
CREATE POLICY "admin_all_promo_codes" ON public.promo_codes
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Any authenticated user can read promo_codes (needed to validate during redemption)
CREATE POLICY "users_read_promo_codes" ON public.promo_codes
  FOR SELECT TO authenticated
  USING (true);

-- Users can record their own redemptions
CREATE POLICY "users_insert_redeemed" ON public.redeemed_codes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can check their own redemption history
CREATE POLICY "users_read_own_redeemed" ON public.redeemed_codes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can see all redemptions
CREATE POLICY "admin_read_all_redeemed" ON public.redeemed_codes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- â”€â”€ Indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE INDEX IF NOT EXISTS promo_codes_code_idx        ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS redeemed_codes_user_idx     ON public.redeemed_codes(user_id);
CREATE INDEX IF NOT EXISTS redeemed_codes_code_id_idx  ON public.redeemed_codes(code_id);

-- â”€â”€ Seed â€” 5 Launch Codes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3 Ã— Enterprise  (1-time use each)
-- 2 Ã— Startup     (1-time use each)

INSERT INTO public.promo_codes (code, reward_type, target_plan, scans_to_add, uses_left)
VALUES
  ('FG-ENT-ALPHA', 'plan_upgrade', 'enterprise', 1, 1),
  ('FG-ENT-SIGMA', 'plan_upgrade', 'enterprise', 1, 1),
  ('FG-ENT-OMEGA', 'plan_upgrade', 'enterprise', 1, 1),
  ('FG-STR-DELTA', 'plan_upgrade', 'startup',    1, 1),
  ('FG-STR-GAMMA', 'plan_upgrade', 'startup',    1, 1)
ON CONFLICT (code) DO NOTHING;

-- ========== 20260517_sprint10_sovereign.sql ==========

-- =============================================================================
-- Sprint 10 â€” Sovereign Dominance schema
-- =============================================================================
-- Tables:
--   agent_memories        : AI step-by-step "Thoughts" stored per scan
--   target_verifications  : domain/IP ownership proofs (DNS TXT or file)
--   bounty_escrow         : payment hold/release state per submission
-- =============================================================================

-- â”€â”€â”€ agent_memories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.agent_memories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id     uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Which model/role generated this thought
  agent_role  text NOT NULL CHECK (agent_role IN ('general','soldier_payload','soldier_recon','reporter')),
  model_id    text NOT NULL,          -- e.g. "deepseek/deepseek-r1", "dolphin-2.9", "llama-3.3-70b"

  -- The thought itself
  thought     text NOT NULL,          -- plain-English reasoning step
  tool_call   jsonb,                  -- tool name + args if any
  tool_result jsonb,                  -- tool output if any

  step_index  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_memories: owner can read"
  ON public.agent_memories FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "agent_memories: service role inserts"
  ON public.agent_memories FOR INSERT
  WITH CHECK (true);   -- service role bypasses RLS; anon/user cannot insert

CREATE INDEX idx_agent_memories_scan  ON public.agent_memories (scan_id, step_index);
CREATE INDEX idx_agent_memories_user  ON public.agent_memories (user_id, created_at DESC);

-- Realtime â€” let the report page subscribe to live thought streaming
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_memories;


-- â”€â”€â”€ target_verifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.target_verifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_domain   text NOT NULL,       -- e.g. "example.com"
  method          text NOT NULL CHECK (method IN ('dns_txt','file_upload','email_confirm')),
  token           text NOT NULL,       -- the verification token we issued
  verified        boolean NOT NULL DEFAULT false,
  verified_at     timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, target_domain)
);

ALTER TABLE public.target_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verifications: owner CRUD"
  ON public.target_verifications
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_target_verif_user   ON public.target_verifications (user_id);
CREATE INDEX idx_target_verif_domain ON public.target_verifications (target_domain);


-- â”€â”€â”€ bounty_escrow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.bounty_escrow (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL,       -- FK to bounty submissions (soft ref, no cascade)
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount_usd      numeric(10,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'USD',

  -- Lifecycle: held â†’ released | refunded
  status          text NOT NULL DEFAULT 'held'
                  CHECK (status IN ('held','released','refunded','pending')),

  held_at         timestamptz NOT NULL DEFAULT now(),
  released_at     timestamptz,
  release_note    text,               -- admin note on payout

  -- Payment processor refs (LS / Stripe)
  processor       text,               -- 'lemonsqueezy' | 'stripe' | 'manual'
  processor_ref   text,               -- order_id / payment_intent_id
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bounty_escrow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escrow: owner can read"
  ON public.bounty_escrow FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "escrow: service role full access"
  ON public.bounty_escrow FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_bounty_escrow_user       ON public.bounty_escrow (user_id);
CREATE INDEX idx_bounty_escrow_submission ON public.bounty_escrow (submission_id);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_bounty_escrow_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_bounty_escrow_updated
  BEFORE UPDATE ON public.bounty_escrow
  FOR EACH ROW EXECUTE FUNCTION public.set_bounty_escrow_updated_at();

-- ========== 20260517_sprint8_identity.sql ==========

-- ============================================================
-- Sprint 8: Identity & Legal Handshake Gate
-- ForgeGuard AI â€” 2026-05-17
-- ============================================================

-- â”€â”€â”€ 1. Profile Identity Columns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_type        text    NOT NULL DEFAULT 'hacker'
                                            CHECK (user_type IN ('client', 'hacker', 'developer')),
  ADD COLUMN IF NOT EXISTS access_level     integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS domain_verified  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS domain_token     text;

COMMENT ON COLUMN profiles.user_type       IS 'Self-selected identity: client | hacker | developer';
COMMENT ON COLUMN profiles.access_level    IS '1=Client, 2=Hacker, 3=Developer';
COMMENT ON COLUMN profiles.domain_verified IS 'True after DNS TXT record verification passes';
COMMENT ON COLUMN profiles.domain_token    IS 'Random token placed in DNS TXT record for verification';

-- Index for fast leaderboard filtering by type
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles (user_type);

-- â”€â”€â”€ 2. legal_authorizations Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS legal_authorizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scan_id     uuid        REFERENCES scans (id) ON DELETE SET NULL,
  full_name   text        NOT NULL,
  ip_address  text        NOT NULL,
  user_agent  text,
  intensity   text        NOT NULL CHECK (intensity IN ('high', 'nuclear')),
  consented   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  legal_authorizations                IS 'Legal consent records for High/Nuclear intensity scans';
COMMENT ON COLUMN legal_authorizations.full_name      IS 'User-supplied legal name at time of authorization';
COMMENT ON COLUMN legal_authorizations.ip_address     IS 'Client IP captured server-side at submission';
COMMENT ON COLUMN legal_authorizations.intensity      IS 'Scan intensity level that required authorization';

-- Fast lookup: most recent auth for a user
CREATE INDEX IF NOT EXISTS idx_legal_auth_user_id    ON legal_authorizations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_auth_scan_id    ON legal_authorizations (scan_id);

-- â”€â”€â”€ 3. Row Level Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE legal_authorizations ENABLE ROW LEVEL SECURITY;

-- Users can only read their own authorizations
CREATE POLICY "Users read own legal_authorizations"
  ON legal_authorizations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert via service-role only (Server Action uses admin client)
-- No INSERT policy for authenticated â€” writes go through admin client

-- Admins (service role) bypass RLS by default

-- â”€â”€â”€ 4. Refresh profiles_with_rank VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Drop and recreate to include new columns

DROP VIEW IF EXISTS profiles_with_rank;

CREATE OR REPLACE VIEW profiles_with_rank AS
SELECT
  p.*,
  CASE
    WHEN p.reputation >= 1000 THEN 'Legend'
    WHEN p.reputation >= 100  THEN 'Elite'
    ELSE                           'Recruit'
  END                                              AS rank_label,
  CASE
    WHEN p.reputation >= 1000 THEN
      LEAST(100, ((p.reputation - 1000)::numeric / 9000) * 100)
    WHEN p.reputation >= 100 THEN
      ((p.reputation - 100)::numeric / 900) * 100
    ELSE
      (p.reputation::numeric / 100) * 100
  END                                              AS rank_progress,
  CASE
    WHEN p.reputation >= 1000 THEN 10000
    WHEN p.reputation >= 100  THEN 1000
    ELSE                           100
  END                                              AS rank_ceiling
FROM profiles p;

COMMENT ON VIEW profiles_with_rank IS 'Profiles enriched with rank label, progress, and ceiling â€” includes Sprint 8 identity columns';

-- â”€â”€â”€ 5. Helper: generate_domain_token() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Called by the domain-verify Server Action to stamp a token

CREATE OR REPLACE FUNCTION generate_domain_token(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := 'fgai-verify-' || encode(gen_random_bytes(16), 'hex');
  UPDATE profiles
     SET domain_token = v_token
   WHERE id = p_user_id;
  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION generate_domain_token IS 'Generates and persists a DNS verification token for domain ownership proof';

-- ========== 20260517_sprint9_aegis_intel.sql ==========

-- ============================================================
-- Sprint 9: Aegis Rules + Intelligence Hub Tables
-- ForgeGuard AI â€” 2026-05-17
-- ============================================================
-- Depends on: 0002_agathon_schema.sql (scans table)
--             20260517_sprint8_identity.sql (profiles.access_level)
-- ============================================================

-- â”€â”€â”€ 1. aegis_rules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Stores WAF rules exported from completed scans via
-- POST /api/aegis/export. Persisted for cross-reference in
-- Bounty Vault triage (AegisCoverage).

CREATE TABLE IF NOT EXISTS aegis_rules (
  id          bigserial   PRIMARY KEY,
  scan_id     uuid        NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
  rule_id     text        NOT NULL UNIQUE,          -- fg-aegis-<technique>-<ts36>
  pattern     text        NOT NULL,                 -- WAF expression (truncated at 500 chars)
  description text        NOT NULL,
  action      text        NOT NULL CHECK (action IN ('block', 'challenge', 'log')),
  format      text        NOT NULL DEFAULT 'cloudflare'
                                   CHECK (format IN ('cloudflare', 'python')),
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  aegis_rules             IS 'WAF rules auto-generated by Aegis Defense export from scan findings';
COMMENT ON COLUMN aegis_rules.rule_id     IS 'Stable unique ref: fg-aegis-<technique>-<ts36>. Used as upsert key.';
COMMENT ON COLUMN aegis_rules.pattern     IS 'Cloudflare WAF expression or Python regex (â‰¤500 chars)';
COMMENT ON COLUMN aegis_rules.format      IS 'Target platform: cloudflare | python';

CREATE INDEX IF NOT EXISTS idx_aegis_rules_scan_id  ON aegis_rules (scan_id);
CREATE INDEX IF NOT EXISTS idx_aegis_rules_enabled   ON aegis_rules (enabled) WHERE enabled = true;

-- Updated-at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aegis_rules_updated_at ON aegis_rules;
CREATE TRIGGER trg_aegis_rules_updated_at
  BEFORE UPDATE ON aegis_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: users can only see rules from their own scans
ALTER TABLE aegis_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own aegis_rules"
  ON aegis_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scans s
       WHERE s.id = aegis_rules.scan_id
         AND s.user_id = auth.uid()
    )
  );

-- Writes go through service-role (admin client) in API routes.
-- No INSERT/UPDATE policy for authenticated role.


-- â”€â”€â”€ 2. intel_messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Community chat messages for the Intelligence Hub.
-- Populated and subscribed to via Supabase Realtime on the
-- /dashboard/intel page. Each row is a single chat message.

CREATE TABLE IF NOT EXISTS intel_messages (
  id          bigserial   PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content     text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  intel_messages          IS 'Real-time community chat messages for the Intelligence Hub';
COMMENT ON COLUMN intel_messages.content  IS 'Message body, 1â€“500 characters';

-- Fast retrieval of recent messages (last N by time)
CREATE INDEX IF NOT EXISTS idx_intel_messages_created_at ON intel_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_messages_user_id    ON intel_messages (user_id);

-- RLS: authenticated users can read all messages + insert their own
ALTER TABLE intel_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read intel_messages"
  ON intel_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users insert own intel_messages"
  ON intel_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE / DELETE for regular users â€” messages are immutable once sent.
-- Admins (service role) bypass RLS by default.


-- â”€â”€â”€ 3. Enable Realtime on intel_messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Supabase Realtime must have the table in the publication.
-- Run this once; idempotent thanks to IF NOT EXISTS / OR REPLACE.

ALTER PUBLICATION supabase_realtime ADD TABLE intel_messages;


-- â”€â”€â”€ 4. Helper view: intel_messages_with_profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Joins messages with display names so the chat UI gets the
-- sender's handle without a separate profile query per message.

CREATE OR REPLACE VIEW intel_messages_with_profile AS
SELECT
  m.id,
  m.user_id,
  m.content,
  m.created_at,
  COALESCE(p.full_name, p.username, 'Anonymous') AS display_name
FROM intel_messages m
LEFT JOIN profiles p ON p.id = m.user_id;

COMMENT ON VIEW intel_messages_with_profile IS 'Intel Hub chat messages enriched with sender display name';

-- RLS on the view is inherited from intel_messages (underlying table).

-- ========== 20260518_sprint11_sovereign_machine.sql ==========

-- =============================================================================
-- Sprint 11 â€” The Sovereign Machine schema
-- =============================================================================
-- Tables:
--   user_wallets      : balance tracking per user (Bazaar commerce)
--   bazaar_scripts    : Hacker Bazaar marketplace listings
--   bazaar_purchases  : purchase ledger
--   hacker_repos      : Hacker-Git repositories
--   repo_stars        : per-user star record (uniqueness enforced)
-- =============================================================================

-- â”€â”€â”€ user_wallets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.user_wallets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  balance_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id)
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets: owner read/update"
  ON public.user_wallets
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "wallets: service role full access"
  ON public.user_wallets FOR ALL
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_wallet_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_wallet_updated
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_wallet_updated_at();

-- Auto-create wallet on new user
CREATE OR REPLACE FUNCTION public.create_user_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_wallet_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_wallet();


-- â”€â”€â”€ bazaar_scripts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.bazaar_scripts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metadata
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  language        text NOT NULL DEFAULT 'python'
                  CHECK (language IN ('python','bash','javascript','rust')),
  tags            text[] NOT NULL DEFAULT '{}',

  -- The script body (stored server-side; never returned raw to buyer pre-purchase)
  code            text NOT NULL,

  -- Commerce
  price_usd       numeric(8,2) NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
  is_free         boolean NOT NULL GENERATED ALWAYS AS (price_usd = 0) STORED,
  purchase_count  integer NOT NULL DEFAULT 0,
  revenue_usd     numeric(12,2) NOT NULL DEFAULT 0,

  -- AI Customs audit result
  audit_verdict   text NOT NULL DEFAULT 'pending'
                  CHECK (audit_verdict IN ('pending','cleared','flagged','rejected')),
  audit_risk_score integer NOT NULL DEFAULT 0 CHECK (audit_risk_score BETWEEN 0 AND 100),
  audit_findings  jsonb,
  audit_reason    text,
  audited_at      timestamptz,

  -- Visibility
  is_published    boolean NOT NULL DEFAULT false,
  is_removed      boolean NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bazaar_scripts ENABLE ROW LEVEL SECURITY;

-- Authors can see all their own scripts
CREATE POLICY "bazaar: author CRUD"
  ON public.bazaar_scripts
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Authenticated users can read published & cleared scripts
CREATE POLICY "bazaar: public read published"
  ON public.bazaar_scripts FOR SELECT
  USING (
    is_published = true
    AND is_removed = false
    AND audit_verdict = 'cleared'
  );

CREATE POLICY "bazaar: service role full access"
  ON public.bazaar_scripts FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_bazaar_scripts_author    ON public.bazaar_scripts (author_id);
CREATE INDEX idx_bazaar_scripts_published ON public.bazaar_scripts (is_published, audit_verdict, is_removed);

CREATE OR REPLACE FUNCTION public.set_bazaar_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_bazaar_updated
  BEFORE UPDATE ON public.bazaar_scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_bazaar_updated_at();


-- â”€â”€â”€ bazaar_purchases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.bazaar_purchases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id   uuid NOT NULL REFERENCES public.bazaar_scripts(id) ON DELETE RESTRICT,
  buyer_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount_usd  numeric(8,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (script_id, buyer_id)  -- one purchase per user
);

ALTER TABLE public.bazaar_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases: buyer can read own"
  ON public.bazaar_purchases FOR SELECT
  USING (buyer_id = auth.uid() OR author_id = auth.uid());

CREATE POLICY "purchases: service role full access"
  ON public.bazaar_purchases FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_bazaar_purchases_buyer  ON public.bazaar_purchases (buyer_id);
CREATE INDEX idx_bazaar_purchases_author ON public.bazaar_purchases (author_id);
CREATE INDEX idx_bazaar_purchases_script ON public.bazaar_purchases (script_id);


-- â”€â”€â”€ hacker_repos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.hacker_repos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  language      text NOT NULL DEFAULT 'python',
  tags          text[] NOT NULL DEFAULT '{}',

  -- Main script content (single-file repo, extensible)
  code          text NOT NULL DEFAULT '',

  -- Visibility
  is_public     boolean NOT NULL DEFAULT false,
  is_archived   boolean NOT NULL DEFAULT false,

  -- Social
  star_count    integer NOT NULL DEFAULT 0 CHECK (star_count >= 0),

  -- Version tracking
  version       text NOT NULL DEFAULT '1.0.0',
  commit_count  integer NOT NULL DEFAULT 1,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (owner_id, name)
);

ALTER TABLE public.hacker_repos ENABLE ROW LEVEL SECURITY;

-- Owner CRUD
CREATE POLICY "repos: owner CRUD"
  ON public.hacker_repos
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Authenticated users can read public repos
CREATE POLICY "repos: public read"
  ON public.hacker_repos FOR SELECT
  USING (is_public = true AND is_archived = false);

CREATE POLICY "repos: service role full access"
  ON public.hacker_repos FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_hacker_repos_owner  ON public.hacker_repos (owner_id);
CREATE INDEX idx_hacker_repos_public ON public.hacker_repos (is_public, star_count DESC);

CREATE OR REPLACE FUNCTION public.set_repo_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_repo_updated
  BEFORE UPDATE ON public.hacker_repos
  FOR EACH ROW EXECUTE FUNCTION public.set_repo_updated_at();


-- â”€â”€â”€ repo_stars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.repo_stars (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id     uuid NOT NULL REFERENCES public.hacker_repos(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (repo_id, user_id)
);

ALTER TABLE public.repo_stars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repo_stars: auth read"
  ON public.repo_stars FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "repo_stars: user insert own"
  ON public.repo_stars FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "repo_stars: user delete own"
  ON public.repo_stars FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_repo_stars_repo  ON public.repo_stars (repo_id);
CREATE INDEX idx_repo_stars_user  ON public.repo_stars (user_id);

-- â”€â”€â”€ Star â†’ reputation trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--
--  Each star on a public repo earns the repo owner +10 reputation.
--  Each un-star subtracts 10.
--  This requires a `reputation` column on `profiles`.
--  We guard with IF EXISTS so the migration is idempotent even if the
--  profiles schema differs slightly.
--

CREATE OR REPLACE FUNCTION public.sync_star_reputation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Resolve repo owner
  SELECT owner_id INTO v_owner_id
  FROM public.hacker_repos
  WHERE id = COALESCE(NEW.repo_id, OLD.repo_id);

  IF TG_OP = 'INSERT' THEN
    -- Bump star_count on repo
    UPDATE public.hacker_repos
       SET star_count = star_count + 1
     WHERE id = NEW.repo_id;

    -- Add +10 rep to owner profile
    UPDATE public.profiles
       SET reputation = COALESCE(reputation, 0) + 10
     WHERE user_id = v_owner_id;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement star_count (floor 0)
    UPDATE public.hacker_repos
       SET star_count = GREATEST(star_count - 1, 0)
     WHERE id = OLD.repo_id;

    -- Subtract 10 rep (floor 0)
    UPDATE public.profiles
       SET reputation = GREATEST(COALESCE(reputation, 0) - 10, 0)
     WHERE user_id = v_owner_id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_repo_star_reputation
  AFTER INSERT OR DELETE ON public.repo_stars
  FOR EACH ROW EXECUTE FUNCTION public.sync_star_reputation();


-- â”€â”€â”€ Realtime subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER PUBLICATION supabase_realtime ADD TABLE public.bazaar_scripts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hacker_repos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.repo_stars;


-- â”€â”€â”€ RPC: increment_wallet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  Called by bazaar/purchase route to credit author balance atomically.
--  Uses SECURITY DEFINER so the route's service-role client can invoke it.

CREATE OR REPLACE FUNCTION public.increment_wallet(
  p_user_id uuid,
  p_amount  numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id, balance_usd)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance_usd = public.user_wallets.balance_usd + EXCLUDED.balance_usd,
        updated_at  = now();
END;
$$;


-- â”€â”€â”€ RPC: increment_purchase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  Called by bazaar/purchase route after a successful paid purchase to update
--  script counters atomically.

CREATE OR REPLACE FUNCTION public.increment_purchase(
  p_script_id uuid,
  p_revenue   numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.bazaar_scripts
     SET purchase_count = purchase_count + 1,
         revenue_usd    = revenue_usd + p_revenue,
         updated_at     = now()
   WHERE id = p_script_id;
END;
$$;


-- â”€â”€â”€ enterprise_api_keys â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  Aegis 2.0 Threat Intel API â€” enterprise API key management.
--  Keys are issued manually (admin panel) or via future onboarding flow.

CREATE TABLE IF NOT EXISTS public.enterprise_api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      text NOT NULL,                        -- customer org identifier
  api_key     text NOT NULL UNIQUE,                 -- bearer token (sha256 hash recommended in prod)
  plan        text NOT NULL DEFAULT 'starter'
              CHECK (plan IN ('starter','professional','enterprise','admin')),
  is_active   boolean NOT NULL DEFAULT true,
  hit_count   integer NOT NULL DEFAULT 0,
  last_hit    timestamptz,
  expires_at  timestamptz,                          -- NULL = non-expiring
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_api_keys ENABLE ROW LEVEL SECURITY;

-- Only service-role / admin can manage API keys (no user-facing RLS read)
CREATE POLICY "api_keys: service role only"
  ON public.enterprise_api_keys FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_enterprise_api_keys_key    ON public.enterprise_api_keys (api_key);
CREATE INDEX idx_enterprise_api_keys_org    ON public.enterprise_api_keys (org_id);
CREATE INDEX idx_enterprise_api_keys_active ON public.enterprise_api_keys (is_active, expires_at);

-- ========== 20260518_sprint12_aegis_firewall.sql ==========

-- =============================================================================
-- Sprint 12 â€” Aegis Firewall schema additions
-- =============================================================================
-- Changes:
--   user_wallets  : +is_frozen, +frozen_reason, +frozen_at (freeze gate)
--   profiles      : +hacker_rank (RECRUIT â†’ HACKER â†’ ELITE â†’ TRAITOR)
--   subscriptions : new table â€” plan-gating for enterprise API access
--   freeze_wallet : SECURITY DEFINER RPC â€” atomic freeze without exposing service key
-- =============================================================================

-- â”€â”€â”€ user_wallets: freeze columns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS is_frozen     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS frozen_at     timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.user_wallets.is_frozen     IS 'True when account is frozen pending admin review';
COMMENT ON COLUMN public.user_wallets.frozen_reason IS 'Human-readable reason recorded at freeze time';
COMMENT ON COLUMN public.user_wallets.frozen_at     IS 'UTC timestamp of most recent freeze event';

-- â”€â”€â”€ profiles: hacker_rank â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hacker_rank text NOT NULL DEFAULT 'RECRUIT'
    CHECK (hacker_rank IN ('RECRUIT','HACKER','ELITE','TRAITOR'));

COMMENT ON COLUMN public.profiles.hacker_rank IS 'Platform rank tier; TRAITOR = policy violation detected, account restricted';

-- â”€â”€â”€ subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','cancelled','past_due','trialing')),
  plan        text        NOT NULL DEFAULT 'free'
                          CHECK (plan IN ('free','pro','enterprise')),

  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz DEFAULT NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Owners can read their own subscription
CREATE POLICY "subscriptions: owner read"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Service role manages all subscriptions
CREATE POLICY "subscriptions: service role all"
  ON public.subscriptions FOR ALL
  USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_subscription_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_subscription_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();

-- Auto-create free subscription on signup (matches wallet auto-creation)
CREATE OR REPLACE FUNCTION public.create_user_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, plan)
  VALUES (NEW.id, 'active', 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_subscription_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_subscription();

-- â”€â”€â”€ freeze_wallet RPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Called from application layer when a policy violation is detected.
-- SECURITY DEFINER runs with elevated privileges so the route does not need
-- the service-role key exposed to the client bundle.

CREATE OR REPLACE FUNCTION public.freeze_wallet(
  p_user_id uuid,
  p_reason  text DEFAULT 'Policy violation detected'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert: create wallet row if it doesn't exist, then mark frozen
  INSERT INTO public.user_wallets (user_id, is_frozen, frozen_reason, frozen_at)
  VALUES (p_user_id, true, p_reason, now())
  ON CONFLICT (user_id) DO UPDATE
    SET is_frozen     = true,
        frozen_reason = EXCLUDED.frozen_reason,
        frozen_at     = now(),
        updated_at    = now();

  -- Also update the profile hacker_rank
  UPDATE public.profiles
  SET hacker_rank = 'TRAITOR'
  WHERE user_id = p_user_id;
END;
$$;

-- Restrict: only authenticated users may call this, but the effective
-- executor is the function owner (service). We revoke public execute
-- and rely on the server-side route (which uses the service role) to invoke it.
REVOKE ALL ON FUNCTION public.freeze_wallet(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.freeze_wallet(uuid, text) TO service_role;

-- â”€â”€â”€ Index support â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE INDEX IF NOT EXISTS idx_user_wallets_frozen  ON public.user_wallets (is_frozen) WHERE is_frozen = true;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (user_id, status, plan);

-- â”€â”€â”€ Realtime for subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;

-- ========== 20260518_war_machine_leads.sql ==========

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- War Machine â€” leads table
-- Migration: 20260518_war_machine_leads.sql
--
-- Tracks every scraped lead through the full outreach pipeline:
--   new â†’ emailed â†’ clicked â†’ responded â†’ converted
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.leads (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company identity
  company_name   TEXT        NOT NULL,
  website_url    TEXT        UNIQUE,          -- used for upsert dedup
  founder_name   TEXT,
  email          TEXT,
  description    TEXT,

  -- Source metadata
  source         TEXT        NOT NULL DEFAULT 'manual'
                               CHECK (source IN ('yc', 'producthunt', 'x', 'manual')),
  batch          TEXT,                        -- e.g. 'W24', 'S23' (YC only)

  -- Marineford rank
  rank           TEXT        NOT NULL DEFAULT 'Recruit'
                               CHECK (rank IN ('Recruit', 'Lieutenant', 'Admiral')),

  -- AI-generated content
  scare_hook     TEXT,
  vulnerability  TEXT,
  subject_line   TEXT,

  -- Outreach status
  status         TEXT        NOT NULL DEFAULT 'new'
                               CHECK (status IN ('new','emailed','clicked','responded','converted','bounced','unsubscribed')),

  -- Click tracking (UUID generated on insert â€” share in email links)
  click_token    UUID        NOT NULL DEFAULT gen_random_uuid(),

  -- Timestamps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  emailed_at     TIMESTAMPTZ,
  clicked_at     TIMESTAMPTZ,
  responded_at   TIMESTAMPTZ,

  -- Resend message ID for delivery tracking
  resend_msg_id  TEXT
);

-- â”€â”€â”€ Indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS leads_status_idx        ON public.leads (status);
CREATE INDEX IF NOT EXISTS leads_click_token_idx   ON public.leads (click_token);
CREATE INDEX IF NOT EXISTS leads_source_idx        ON public.leads (source);
CREATE INDEX IF NOT EXISTS leads_created_at_idx    ON public.leads (created_at DESC);

-- â”€â”€â”€ RLS (service role bypasses; restrict anon/auth reads) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Only service role (war machine Python scripts) can read/write
-- No policies for anon or authenticated â€” this table is internal only
-- The click-tracking route uses the service role key server-side

-- â”€â”€â”€ Admin read policy (optional: let admin dashboard query leads) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE POLICY "Admin can read leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.access_level >= 4
    )
  );

-- â”€â”€â”€ Comments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
COMMENT ON TABLE  public.leads                IS 'War Machine outreach pipeline â€” scraped leads from YC, Product Hunt, and X';
COMMENT ON COLUMN public.leads.click_token    IS 'UUID embedded in cold email CTA links; clicking marks status=clicked';
COMMENT ON COLUMN public.leads.scare_hook     IS 'AI-generated 2-sentence vulnerability hook sent in the email';
COMMENT ON COLUMN public.leads.vulnerability  IS 'Short name of the identified vulnerability (e.g. Prompt Injection)';
COMMENT ON COLUMN public.leads.rank           IS 'Marineford rank: Recruit (cold), Lieutenant (seed-stage), Admiral (Series A+)';

-- ========== 20260519_marine_machine.sql ==========

-- ============================================================
-- Sprint 13: Marine Machine
-- terminal_inputs Â· recon_targets Â· repo_files Â· bazaar patch
-- ============================================================

-- â”€â”€ terminal_inputs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ recon_targets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ repo_files â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ bazaar_scripts: add audit_verdict if missing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- ========== 20260520_genesis_scan_reports.sql ==========

-- ============================================================
-- ForgeGuard AI â€” Genesis Intelligence Pipeline
-- Sprint: Total System Integration
-- Date:   2026-05-20
--
-- Adds four columns to scan_reports for the Elite 8 pipeline output:
--   discovery_report  JSONB  â€” full attack-surface map from DiscoveryEngine
--   ale_usd           FLOAT  â€” Projected Annual Loss Expectancy ($ALE) from RiskQuantifier
--   social_templates  JSONB  â€” phishing/vishing training templates from SocialSwarm
--   aegis_zip_b64     TEXT   â€” base64 Aegis Rule Bundle ZIP from PatchGenerator
-- ============================================================

-- Add new columns if they don't already exist (idempotent)
ALTER TABLE scan_reports
  ADD COLUMN IF NOT EXISTS discovery_report    JSONB    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ale_usd             FLOAT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_templates    JSONB    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aegis_zip_b64       TEXT     DEFAULT NULL;

-- Index discovery_report for dashboard queries (e.g. filter by endpoint count)
CREATE INDEX IF NOT EXISTS idx_scan_reports_discovery_report
  ON scan_reports USING GIN (discovery_report)
  WHERE discovery_report IS NOT NULL;

-- Index ale_usd for sorted financial risk dashboards
CREATE INDEX IF NOT EXISTS idx_scan_reports_ale_usd
  ON scan_reports (ale_usd DESC NULLS LAST)
  WHERE ale_usd IS NOT NULL;

-- Comment the columns for discoverability
COMMENT ON COLUMN scan_reports.discovery_report IS
  'DiscoveryEngine output: { pages_crawled, api_endpoints[], input_vectors[], crawl_errors[], base_url }';

COMMENT ON COLUMN scan_reports.ale_usd IS
  'RiskQuantifier Projected Annual Loss Expectancy in USD (IBM 2026 breach-cost model)';

COMMENT ON COLUMN scan_reports.social_templates IS
  'SocialSwarm training templates array: [{ template_id, category, platform, subject, content, red_flags[], training_debrief, watermark }]';

COMMENT ON COLUMN scan_reports.aegis_zip_b64 IS
  'Base64-encoded ZIP of PatchGenerator Aegis Rule Bundle (FastAPI + Next.js + System Prompt guardrails)';

-- ========== 20260520_mission_vault.sql ==========

-- =============================================================
-- Mission Vault â€” Stronghold 2.0
-- Tables: missions, mission_proposals, mission_messages
-- =============================================================

-- â”€â”€ 1. missions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.missions (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             text         NOT NULL,
  description       text         NOT NULL,
  scope             text,                        -- target scope / rules of engagement
  budget_credits    integer      NOT NULL DEFAULT 0,
  required_rank     text         NOT NULL DEFAULT 'RECRUIT', -- RECRUIT | OPERATIVE | ELITE | SOVEREIGN
  company_tag       text,                        -- e.g. "GOOGLE SEC" shown as badge
  domain_verified   boolean      NOT NULL DEFAULT false,
  status            text         NOT NULL DEFAULT 'open', -- open | in_progress | completed | cancelled
  selected_hacker_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Clients can insert their own missions
CREATE POLICY "missions_insert_own" ON public.missions
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Everyone (authenticated) can read open missions
CREATE POLICY "missions_select_open" ON public.missions
  FOR SELECT TO authenticated
  USING (status = 'open' OR client_id = auth.uid() OR selected_hacker_id = auth.uid());

-- Clients can update their own missions
CREATE POLICY "missions_update_own" ON public.missions
  FOR UPDATE TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_missions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER missions_set_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.set_missions_updated_at();

-- â”€â”€ 2. mission_proposals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.mission_proposals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid        NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  hacker_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pitch       text        NOT NULL,
  timeline    text,                        -- e.g. "2â€“3 days"
  ask_credits integer     NOT NULL DEFAULT 0,
  status      text        NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, hacker_id)
);

ALTER TABLE public.mission_proposals ENABLE ROW LEVEL SECURITY;

-- Hackers can submit proposals
CREATE POLICY "proposals_insert_own" ON public.mission_proposals
  FOR INSERT TO authenticated
  WITH CHECK (hacker_id = auth.uid());

-- Hackers see their own; clients see proposals on their missions
CREATE POLICY "proposals_select" ON public.mission_proposals
  FOR SELECT TO authenticated
  USING (
    hacker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_id AND m.client_id = auth.uid()
    )
  );

-- Clients can accept/reject proposals on their missions
CREATE POLICY "proposals_update_client" ON public.mission_proposals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_id AND m.client_id = auth.uid()
    )
  );

-- â”€â”€ 3. mission_messages (Realtime DM) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.mission_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid        NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sender_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_messages ENABLE ROW LEVEL SECURITY;

-- Only mission participants (client + selected hacker) can read/write messages
CREATE POLICY "messages_select" ON public.mission_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_id
        AND (m.client_id = auth.uid() OR m.selected_hacker_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert" ON public.mission_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_id
        AND (m.client_id = auth.uid() OR m.selected_hacker_id = auth.uid())
    )
  );

-- Enable Realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_messages;

-- â”€â”€ 4. indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS missions_client_id_idx    ON public.missions(client_id);
CREATE INDEX IF NOT EXISTS missions_status_idx        ON public.missions(status);
CREATE INDEX IF NOT EXISTS proposals_mission_idx      ON public.mission_proposals(mission_id);
CREATE INDEX IF NOT EXISTS messages_mission_time_idx  ON public.mission_messages(mission_id, created_at);

-- ========== 20260520_sovereign_identity.sql ==========

-- =============================================================
-- Sovereign Identity â€” Stronghold 2.0
-- Adds identity-proofing columns to profiles table
-- =============================================================

-- Signature (stored as base64 data URL)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_data  text,
  ADD COLUMN IF NOT EXISTS signature_at    timestamptz;

-- Domain verification
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_domain       text,
  ADD COLUMN IF NOT EXISTS domain_verify_token  text,
  ADD COLUMN IF NOT EXISTS domain_verified      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_tag          text;        -- e.g. "GOOGLE SEC"

-- Identity proofing (webcam) â€” flag only (actual KYC via external provider)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_proofed  boolean NOT NULL DEFAULT false;

-- ========== 20260521_sovereign_verification_pipeline.sql ==========

-- =============================================================
-- Sovereign Verification Pipeline â€” Stronghold 2.0
-- =============================================================

-- â”€â”€ profiles: verification columns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clearance_tier       text NOT NULL DEFAULT 'tactical'
    CHECK (clearance_tier IN ('tactical', 'professional', 'sovereign')),
  ADD COLUMN IF NOT EXISTS identity_document_path text,
  ADD COLUMN IF NOT EXISTS identity_audit_score   numeric(5,2),
  ADD COLUMN IF NOT EXISTS identity_audit_status  text NOT NULL DEFAULT 'none'
    CHECK (identity_audit_status IN ('none','pending','passed','failed','review')),
  ADD COLUMN IF NOT EXISTS identity_audit_notes   text,
  ADD COLUMN IF NOT EXISTS sovereign_pending      boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.identity_verified IS 'True after AI audit + admin grant or auto-pass threshold';
COMMENT ON COLUMN public.profiles.clearance_tier    IS 'tactical | professional | sovereign';
COMMENT ON COLUMN public.profiles.sovereign_pending IS 'Awaiting admin GRANT ACCESS for Sovereign tier';

-- â”€â”€ legal_signatures (chain of custody) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.legal_signatures (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signature_data  text        NOT NULL,
  custody_hash    text        NOT NULL UNIQUE,
  signed_at       timestamptz NOT NULL DEFAULT now(),
  ip_address      text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_signatures_user ON public.legal_signatures (user_id, signed_at DESC);

ALTER TABLE public.legal_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_signatures: owner read"
  ON public.legal_signatures FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- â”€â”€ verification_otps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.verification_otps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone       text        NOT NULL,
  code_hash   text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_otps_user ON public.verification_otps (user_id, created_at DESC);

ALTER TABLE public.verification_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verification_otps: owner read"
  ON public.verification_otps FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ========== 20260521_sprint19_genesis_final.sql ==========

-- Sprint 19: Genesis Final â€” platform_transactions + clearance pending tier

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_clearance_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_clearance_tier_check
  CHECK (clearance_tier IN ('pending', 'tactical', 'professional', 'sovereign'));

CREATE TABLE IF NOT EXISTS public.platform_transactions (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id      uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_id     uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  script_id     uuid          REFERENCES public.bazaar_scripts(id) ON DELETE SET NULL,
  amount_usd    numeric(12,2) NOT NULL DEFAULT 0,
  platform_fee  numeric(12,2) NOT NULL DEFAULT 0,
  author_payout numeric(12,2) NOT NULL DEFAULT 0,
  tx_type       text          NOT NULL DEFAULT 'bazaar_purchase'
                CHECK (tx_type IN ('bazaar_purchase', 'bounty_release', 'top_up', 'refund')),
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_tx_buyer ON public.platform_transactions (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_tx_seller ON public.platform_transactions (seller_id, created_at DESC);

ALTER TABLE public.platform_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_tx: participants read"
  ON public.platform_transactions FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "platform_tx: service role all"
  ON public.platform_transactions FOR ALL
  USING (true) WITH CHECK (true);

-- ========== 20260522_current_persona.sql ==========

-- Persona Switcher â€” persist CLIENT / HACKER / DEV mode across sessions

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_persona text;

UPDATE public.profiles
   SET current_persona = CASE
     WHEN active_view_mode IN ('client', 'hacker') THEN active_view_mode
     WHEN user_type = 'client' THEN 'client'
     WHEN user_type = 'hacker' THEN 'hacker'
     WHEN user_type = 'developer' THEN COALESCE(active_view_mode, 'hacker')
     ELSE 'hacker'
   END
 WHERE current_persona IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN current_persona SET DEFAULT 'hacker';

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_current_persona_check
    CHECK (current_persona IS NULL OR current_persona IN ('client', 'hacker', 'dev'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.profiles.current_persona IS
  'Active UI persona: client | hacker | dev (Sovereign admin console)';

-- ========== 20260522_parallel_sovereignty.sql ==========

-- ============================================================
-- Parallel Sovereignty â€” dual dashboard environments
-- ForgeGuard AI â€” 2026-05-22
-- ============================================================

-- Allow NULL user_type until identity gate completes
ALTER TABLE public.profiles
  ALTER COLUMN user_type DROP NOT NULL,
  ALTER COLUMN user_type DROP DEFAULT;

ALTER TABLE public.profiles
  ALTER COLUMN access_level SET DEFAULT 0;

-- UI environment toggle (client vs hacker workspace)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_view_mode text
    CHECK (active_view_mode IS NULL OR active_view_mode IN ('client', 'hacker'));

COMMENT ON COLUMN public.profiles.active_view_mode IS
  'Parallel Sovereignty: active dashboard environment (client | hacker)';

CREATE INDEX IF NOT EXISTS idx_profiles_active_view_mode
  ON public.profiles (active_view_mode);

-- Backfill view mode from existing identity
UPDATE public.profiles
   SET active_view_mode = CASE
     WHEN user_type = 'client' THEN 'client'
     WHEN user_type IN ('hacker', 'developer') THEN 'hacker'
     ELSE NULL
   END
 WHERE active_view_mode IS NULL AND user_type IS NOT NULL;

-- ========== 20260523_iron_wall_verification.sql ==========

-- Operation: Iron Wall â€” Verification Pipeline schema repair
-- Idempotent; safe to run on live Supabase SQL Editor

BEGIN;

-- â”€â”€â”€ ISSUE 1: Corporate verification columns on profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_domain      text,
  ADD COLUMN IF NOT EXISTS company_tag         text,
  ADD COLUMN IF NOT EXISTS domain_token        text,
  ADD COLUMN IF NOT EXISTS domain_verify_token text,
  ADD COLUMN IF NOT EXISTS domain_verified     boolean NOT NULL DEFAULT false;

-- Reconcile legacy column names
UPDATE public.profiles
   SET domain_token = COALESCE(domain_token, domain_verify_token)
 WHERE domain_token IS NULL AND domain_verify_token IS NOT NULL;

UPDATE public.profiles
   SET domain_verify_token = COALESCE(domain_verify_token, domain_token)
 WHERE domain_verify_token IS NULL AND domain_token IS NOT NULL;

-- â”€â”€â”€ ISSUE 2: OTP queue + audit log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.verification_otps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone       text        NOT NULL,
  code_hash   text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_otps_user
  ON public.verification_otps (user_id, created_at DESC);

ALTER TABLE public.verification_otps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "verification_otps: owner read"
    ON public.verification_otps FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "verification_otps: service insert"
    ON public.verification_otps FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.otp_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  phone        text        NOT NULL,
  status       text        NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued', 'sent', 'failed', 'verified', 'expired')),
  provider     text,
  error_message text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_logs_user
  ON public.otp_logs (user_id, created_at DESC);

ALTER TABLE public.otp_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "otp_logs: owner read"
    ON public.otp_logs FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "otp_logs: service all"
    ON public.otp_logs FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Realtime wallet sync (Issue 4)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_wallets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- ========== 20260524_genesis30_reconcile.sql ==========

-- =============================================================================
-- Genesis 3.0 â€” Schema Reconciliation (live â†’ Genesis target)
-- Idempotent additive migration; backfills from legacy column names.
-- =============================================================================

-- â”€â”€â”€ user_wallets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS balance_usd numeric(12,2),
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason text,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

UPDATE public.user_wallets
   SET balance_usd = COALESCE(balance_usd, balance::numeric, 0)
 WHERE balance_usd IS NULL;

ALTER TABLE public.user_wallets
  ALTER COLUMN balance_usd SET DEFAULT 0;

UPDATE public.user_wallets SET balance_usd = 0 WHERE balance_usd IS NULL;

DO $$ BEGIN
  ALTER TABLE public.user_wallets ALTER COLUMN balance_usd SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- â”€â”€â”€ bazaar_scripts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.bazaar_scripts
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'python',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audit_verdict text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS audit_risk_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audit_findings jsonb,
  ADD COLUMN IF NOT EXISTS audit_reason text,
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_removed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_usd numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.bazaar_scripts SET
  name = COALESCE(name, title, 'Untitled'),
  code = COALESCE(code, code_content, ''),
  audit_verdict = CASE
    WHEN audit_verdict IS NOT NULL AND audit_verdict NOT IN ('pending_audit') THEN audit_verdict
    WHEN status = 'cleared' OR status = 'approved' THEN 'cleared'
    WHEN status = 'rejected' THEN 'rejected'
    WHEN status = 'flagged' THEN 'flagged'
    ELSE COALESCE(audit_verdict, 'pending')
  END,
  audit_risk_score = COALESCE(audit_risk_score, safety_score, 0),
  is_published = COALESCE(is_published, status IN ('cleared', 'approved', 'published'), false),
  price_usd = COALESCE(price_usd::numeric, 0)
WHERE name IS NULL OR code IS NULL;

-- â”€â”€â”€ bazaar_purchases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.bazaar_purchases
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS amount_usd numeric(8,2) DEFAULT 0;

UPDATE public.bazaar_purchases bp
   SET author_id = COALESCE(bp.author_id, bs.author_id),
       amount_usd = COALESCE(bp.amount_usd, bs.price_usd::numeric, 0)
  FROM public.bazaar_scripts bs
 WHERE bp.script_id = bs.id
   AND (bp.author_id IS NULL OR bp.amount_usd IS NULL OR bp.amount_usd = 0);

-- â”€â”€â”€ missions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS selected_hacker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS domain_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.missions SET domain_verified = false WHERE domain_verified IS NULL;

-- â”€â”€â”€ mission_proposals (view over mission_applications) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.mission_proposals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  hacker_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pitch       text NOT NULL DEFAULT '',
  timeline    text,
  ask_credits integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, hacker_id)
);

INSERT INTO public.mission_proposals (id, mission_id, hacker_id, pitch, status, created_at)
SELECT ma.id, ma.mission_id, ma.hacker_id,
       COALESCE(ma.proposal_text, ''),
       COALESCE(ma.status, 'pending'),
       COALESCE(ma.created_at, now())
  FROM public.mission_applications ma
 WHERE NOT EXISTS (
   SELECT 1 FROM public.mission_proposals mp
   WHERE mp.mission_id = ma.mission_id AND mp.hacker_id = ma.hacker_id
 )
ON CONFLICT (mission_id, hacker_id) DO NOTHING;

ALTER TABLE public.mission_proposals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "proposals_select_reconcile" ON public.mission_proposals
    FOR SELECT TO authenticated
    USING (hacker_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.missions m WHERE m.id = mission_id AND m.client_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- â”€â”€â”€ legal_signatures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.legal_signatures
  ADD COLUMN IF NOT EXISTS signature_data text,
  ADD COLUMN IF NOT EXISTS custody_hash text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.legal_signatures
   SET signature_data = COALESCE(signature_data, signature_svg, ''),
       custody_hash = COALESCE(custody_hash, encode(sha256(COALESCE(signature_svg, id::text)::bytea), 'hex'))
 WHERE signature_data IS NULL OR custody_hash IS NULL;

-- â”€â”€â”€ bounty_escrow (Genesis table; migrate from bounty_escrows) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.bounty_escrow (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid,
  mission_id      uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd      numeric(10,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'USD',
  status          text NOT NULL DEFAULT 'held'
                  CHECK (status IN ('held','released','refunded','pending')),
  held_at         timestamptz NOT NULL DEFAULT now(),
  released_at     timestamptz,
  release_note    text,
  processor       text,
  processor_ref   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bounty_escrow ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "escrow_owner_read" ON public.bounty_escrow FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "escrow_service_all" ON public.bounty_escrow FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.bounty_escrow (id, submission_id, user_id, amount_usd, status, created_at)
SELECT be.id, be.bounty_id, be.hacker_id,
       COALESCE(be.amount_usd::numeric, 0),
       COALESCE(be.status, 'held'),
       COALESCE(be.created_at, now())
  FROM public.bounty_escrows be
 WHERE NOT EXISTS (SELECT 1 FROM public.bounty_escrow e WHERE e.id = be.id);

-- â”€â”€â”€ platform_transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.platform_transactions
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS script_id uuid REFERENCES public.bazaar_scripts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_usd numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS author_payout numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tx_type text DEFAULT 'bazaar_purchase';

UPDATE public.platform_transactions
   SET buyer_id = COALESCE(buyer_id, sender_id),
       seller_id = COALESCE(seller_id, receiver_id),
       amount_usd = COALESCE(amount_usd, amount_credits::numeric, 0),
       author_payout = COALESCE(author_payout, amount_credits::numeric, 0),
       tx_type = COALESCE(tx_type, transaction_type, 'bazaar_purchase')
 WHERE buyer_id IS NULL OR seller_id IS NULL;

-- â”€â”€â”€ terminal_inputs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.terminal_inputs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS consumed boolean NOT NULL DEFAULT false;

UPDATE public.terminal_inputs
   SET content = COALESCE(content, input_text, ''),
       consumed = COALESCE(consumed, false)
 WHERE content IS NULL;

CREATE INDEX IF NOT EXISTS terminal_inputs_session_idx
  ON public.terminal_inputs (session_id, consumed, created_at);

-- â”€â”€â”€ profiles active_view_mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_view_mode text;

UPDATE public.profiles
   SET active_view_mode = CASE
     WHEN user_type = 'client' THEN 'client'
     ELSE 'hacker'
   END
 WHERE active_view_mode IS NULL;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_active_view_mode_check
    CHECK (active_view_mode IS NULL OR active_view_mode IN ('client', 'hacker'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- â”€â”€â”€ RPC: increment_wallet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.increment_wallet(
  p_user_id uuid,
  p_amount  numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id, balance_usd, balance)
  VALUES (p_user_id, GREATEST(p_amount, 0), GREATEST(p_amount::integer, 0))
  ON CONFLICT (user_id) DO UPDATE
    SET balance_usd = GREATEST(public.user_wallets.balance_usd + p_amount, 0),
        balance     = GREATEST((public.user_wallets.balance_usd + p_amount)::integer, 0),
        updated_at  = now();
END;
$$;

-- â”€â”€â”€ RPC: increment_purchase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.increment_purchase(
  p_script_id uuid,
  p_revenue   numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.bazaar_scripts
     SET purchase_count = COALESCE(purchase_count, 0) + 1,
         revenue_usd    = COALESCE(revenue_usd, 0) + p_revenue,
         updated_at     = now()
   WHERE id = p_script_id;
END;
$$;

-- â”€â”€â”€ RPC: atomic bazaar purchase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.purchase_bazaar_script(
  p_buyer_id  uuid,
  p_script_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_script record;
  v_balance numeric;
  v_platform_fee numeric;
  v_author_payout numeric;
  v_new_balance numeric;
BEGIN
  SELECT id, author_id, code, price_usd::numeric AS price_usd, is_published, is_removed, audit_verdict
    INTO v_script
    FROM public.bazaar_scripts
   WHERE id = p_script_id;

  IF NOT FOUND OR NOT v_script.is_published OR v_script.is_removed OR v_script.audit_verdict <> 'cleared' THEN
    RETURN jsonb_build_object('error', 'Script not available');
  END IF;

  IF v_script.author_id = p_buyer_id THEN
    RETURN jsonb_build_object('ok', true, 'code', v_script.code, 'spent', 0);
  END IF;

  IF EXISTS (SELECT 1 FROM public.bazaar_purchases WHERE script_id = p_script_id AND buyer_id = p_buyer_id) THEN
    RETURN jsonb_build_object('ok', true, 'code', v_script.code, 'spent', 0);
  END IF;

  IF v_script.price_usd = 0 THEN
    INSERT INTO public.bazaar_purchases (script_id, buyer_id, author_id, amount_usd)
    VALUES (p_script_id, p_buyer_id, v_script.author_id, 0);
    PERFORM public.increment_purchase(p_script_id, 0);
    RETURN jsonb_build_object('ok', true, 'code', v_script.code, 'spent', 0);
  END IF;

  SELECT balance_usd INTO v_balance FROM public.user_wallets WHERE user_id = p_buyer_id;
  v_balance := COALESCE(v_balance, 0);

  IF v_balance < v_script.price_usd THEN
    RETURN jsonb_build_object('error', 'Insufficient funds', 'code', 'INSUFFICIENT_FUNDS');
  END IF;

  v_platform_fee := round(v_script.price_usd * 0.1, 2);
  v_author_payout := round(v_script.price_usd - v_platform_fee, 2);

  PERFORM public.increment_wallet(p_buyer_id, -v_script.price_usd);
  PERFORM public.increment_wallet(v_script.author_id, v_author_payout);

  INSERT INTO public.platform_transactions (buyer_id, seller_id, script_id, amount_usd, platform_fee, author_payout, tx_type)
  VALUES (p_buyer_id, v_script.author_id, p_script_id, v_script.price_usd, v_platform_fee, v_author_payout, 'bazaar_purchase');

  INSERT INTO public.bazaar_purchases (script_id, buyer_id, author_id, amount_usd)
  VALUES (p_script_id, p_buyer_id, v_script.author_id, v_script.price_usd);

  PERFORM public.increment_purchase(p_script_id, v_script.price_usd);

  v_new_balance := v_balance - v_script.price_usd;
  RETURN jsonb_build_object(
    'ok', true, 'code', v_script.code, 'spent', v_script.price_usd,
    'platform_fee', v_platform_fee, 'author_payout', v_author_payout, 'new_balance', v_new_balance
  );
END;
$$;

-- ========== 20260524_ghost_protocol.sql ==========

-- Ghost Protocol â€” profiles.is_ghost_active + subscription_tier gatekeeping
-- Run via CITADEL_LAUNCH_VAULT/RUN_IN_SUPABASE.sql (consolidated master file)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_ghost_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_tier text;

UPDATE public.profiles p
   SET subscription_tier = COALESCE(
     (
       SELECT s.plan FROM public.subscriptions s
        WHERE s.user_id = p.id AND s.status IN ('active', 'trialing', 'past_due')
        ORDER BY s.created_at DESC LIMIT 1
     ),
     NULLIF(p.current_plan, ''),
     'free'
   )
 WHERE p.subscription_tier IS NULL;

DO $$ BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_subscription_tier_check
    CHECK (subscription_tier IS NULL OR subscription_tier IN ('free', 'startup', 'enterprise', 'sovereign'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_ghost_active
  ON public.profiles (is_ghost_active) WHERE is_ghost_active = true;

-- ========== 20260525_legacy_schema_repair.sql ==========

-- Section 12: Legacy schema repair â€” live DB drift (phone_number, otp_logs, replica)
-- Idempotent; safe to run on live Supabase SQL Editor

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.verification_otps RENAME COLUMN phone_number TO phone;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone_number'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone'
  ) THEN
    UPDATE public.verification_otps
       SET phone = COALESCE(phone, phone_number)
     WHERE phone IS NULL;
    ALTER TABLE public.verification_otps DROP COLUMN IF EXISTS phone_number;
  END IF;
END $$;

ALTER TABLE public.verification_otps
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS consumed boolean NOT NULL DEFAULT false;

ALTER TABLE public.otp_logs
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS error_message text;

UPDATE public.otp_logs
   SET status = COALESCE(status, action, 'queued'),
       phone = COALESCE(phone, metadata->>'phone', ''),
       provider = COALESCE(provider, metadata->>'provider'),
       error_message = COALESCE(error_message, metadata->>'error_message')
 WHERE status IS NULL OR phone IS NULL;

ALTER TABLE public.user_wallets REPLICA IDENTITY FULL;

COMMIT;

-- ========== 20260526_attack_logs.sql ==========

-- Section 13: Aegis attack_logs â€” rate-limit burst telemetry
-- Idempotent; safe to run on live Supabase SQL Editor

BEGIN;

CREATE TABLE IF NOT EXISTS public.attack_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  text        NOT NULL,
  path        text,
  method      text,
  user_agent  text,
  reason      text        NOT NULL DEFAULT 'rate_limit_burst',
  blocked_at  timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb       DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_attack_logs_blocked_at
  ON public.attack_logs (blocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_attack_logs_ip
  ON public.attack_logs (ip_address, blocked_at DESC);

ALTER TABLE public.attack_logs ENABLE ROW LEVEL SECURITY;

-- Service role only â€” no anon/authenticated policies (defense in depth)

COMMIT;

-- ========== 20260527_launch_bazaar_seed.sql ==========

-- Section 14: ForgeGuard Certified bazaar seed (idempotent on fixed UUIDs)
DO $$
DECLARE
  v_author uuid;
BEGIN
  SELECT id INTO v_author FROM public.profiles ORDER BY created_at LIMIT 1;
  IF v_author IS NULL THEN
    RAISE NOTICE 'Section 14 skipped â€” no profiles row for author_id';
    RETURN;
  END IF;

  INSERT INTO public.bazaar_scripts (
    id, name, title, description, code, language, tags,
    author_id, is_certified, audit_verdict, is_published, is_removed,
    price_usd, audit_risk_score, safety_score, purchase_count
  ) VALUES
  (
    'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
    'llm-jailbreak-probe',
    'LLM Jailbreak Probe',
    'Multi-vector jailbreak harness for LLM guardrail evaluation and red-team probing.',
    '# ForgeGuard Certified â€” LLM Jailbreak Probe\nprint("jailbreak probe ready")',
    'python',
    ARRAY['llm', 'jailbreak', 'red-team'],
    v_author, true, 'cleared', true, false, 13, 22, 92, 156
  ),
  (
    'aaaaaaaa-0002-4000-8000-000000000002'::uuid,
    'rag-injection-scanner',
    'RAG Injection Scanner',
    'Detects document-poisoning and retrieval injection vectors in RAG pipelines.',
    '# ForgeGuard Certified â€” RAG Injection Scanner\nprint("rag scanner ready")',
    'python',
    ARRAY['rag', 'injection', 'llm'],
    v_author, true, 'cleared', true, false, 15, 35, 88, 98
  ),
  (
    'aaaaaaaa-0003-4000-8000-000000000003'::uuid,
    'prompt-exfil-kit',
    'Prompt Exfil Kit',
    'Structured prompt exfiltration toolkit for system-prompt and secret leakage tests.',
    '# ForgeGuard Certified â€” Prompt Exfil Kit\nprint("exfil kit ready")',
    'python',
    ARRAY['prompt', 'exfil', 'llm'],
    v_author, true, 'cleared', true, false, 10, 41, 85, 203
  ),
  (
    'aaaaaaaa-0004-4000-8000-000000000004'::uuid,
    'agent-tool-hijack',
    'Agent Tool Hijack',
    'Simulates tool-calling hijacks against autonomous agent frameworks.',
    '# ForgeGuard Certified â€” Agent Tool Hijack\nprint("tool hijack ready")',
    'javascript',
    ARRAY['agent', 'tool-calling', 'hijack'],
    v_author, true, 'cleared', true, false, 12, 48, 90, 74
  ),
  (
    'aaaaaaaa-0005-4000-8000-000000000005'::uuid,
    'multi-turn-bypass',
    'Multi-Turn Bypass',
    'Progressive multi-turn bypass sequences for conversational guardrail evasion.',
    '# ForgeGuard Certified â€” Multi-Turn Bypass\nprint("multi-turn bypass ready")',
    'python',
    ARRAY['multi-turn', 'bypass', 'llm'],
    v_author, true, 'cleared', true, false, 9, 38, 87, 131
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    code = EXCLUDED.code,
    language = EXCLUDED.language,
    tags = EXCLUDED.tags,
    is_certified = EXCLUDED.is_certified,
    audit_verdict = EXCLUDED.audit_verdict,
    is_published = EXCLUDED.is_published,
    is_removed = EXCLUDED.is_removed,
    price_usd = EXCLUDED.price_usd,
    audit_risk_score = EXCLUDED.audit_risk_score,
    safety_score = EXCLUDED.safety_score,
    purchase_count = EXCLUDED.purchase_count,
    updated_at = now();
END $$;

-- ========== 20260528_bazaar_is_free_rls_repair.sql ==========

-- Section 15: Bazaar is_free column + RLS policy repair (idempotent)
ALTER TABLE public.bazaar_scripts
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

UPDATE public.bazaar_scripts
   SET is_free = (COALESCE(price_usd, 0) = 0)
 WHERE is_free IS DISTINCT FROM (COALESCE(price_usd, 0) = 0);

COMMENT ON COLUMN public.bazaar_scripts.is_free IS
  'True when price_usd is zero â€” used by /api/bazaar/list free filter.';

DROP POLICY IF EXISTS "bazaar: author CRUD" ON public.bazaar_scripts;
DROP POLICY IF EXISTS "bazaar: public read published" ON public.bazaar_scripts;
DROP POLICY IF EXISTS "bazaar: service role full access" ON public.bazaar_scripts;

CREATE POLICY "bazaar: author CRUD"
  ON public.bazaar_scripts
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "bazaar: public read published"
  ON public.bazaar_scripts FOR SELECT
  USING (
    is_published = true
    AND is_removed = false
    AND audit_verdict = 'cleared'
  );

CREATE POLICY "bazaar: service role full access"
  ON public.bazaar_scripts FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "purchases: buyer can read own" ON public.bazaar_purchases;
DROP POLICY IF EXISTS "purchases: service role full access" ON public.bazaar_purchases;

CREATE POLICY "purchases: buyer can read own"
  ON public.bazaar_purchases FOR SELECT
  USING (buyer_id = auth.uid() OR author_id = auth.uid());

CREATE POLICY "purchases: service role full access"
  ON public.bazaar_purchases FOR ALL
  USING (true) WITH CHECK (true);

-- ========== 20260529_rpc_service_role_only.sql ==========

-- Restrict wallet / bazaar RPCs to service_role (server-side only)
REVOKE EXECUTE ON FUNCTION public.increment_wallet(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_bazaar_script(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_purchase(uuid, numeric) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_wallet(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_wallet(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_bazaar_script(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_purchase(uuid, numeric) TO service_role;

-- ========== 20260530_security_advisor_repair.sql ==========

-- Security Advisor repair â€” search_path, RPC EXECUTE, permissive RLS
-- Run in Supabase SQL Editor after prior migrations.

-- â”€â”€â”€ 1. Immutable search_path on flagged functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_updated_at',
        'touch_updated_at',
        'bump_tool_execution_count',
        'increment_wallet',
        'increment_purchase',
        'purchase_bazaar_script',
        'handle_new_user',
        'is_admin',
        'log_activity'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.sig);
  END LOOP;
END $$;

-- â”€â”€â”€ 2. Wallet / bazaar RPCs â€” service_role only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.increment_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_purchase(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_bazaar_script(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_wallet(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_purchase(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_bazaar_script(uuid, uuid) TO service_role;

-- Legacy overload if present
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.increment_wallet(uuid, integer) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.increment_wallet(uuid, integer) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- â”€â”€â”€ 3. SECURITY DEFINER helpers â€” not callable by anon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.log_activity(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.log_activity(uuid, text, text, uuid, jsonb) TO authenticated, service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- â”€â”€â”€ 4. Replace permissive RLS (USING true) with role-scoped policies â”€â”€â”€â”€â”€â”€â”€â”€

-- otp_logs
DROP POLICY IF EXISTS "otp_logs: service all" ON public.otp_logs;
CREATE POLICY "otp_logs: service role all"
  ON public.otp_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- verification_otps
DROP POLICY IF EXISTS "verification_otps: service insert" ON public.verification_otps;
CREATE POLICY "verification_otps: service role all"
  ON public.verification_otps FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- bounty_escrow
DROP POLICY IF EXISTS "escrow_service_all" ON public.bounty_escrow;
CREATE POLICY "escrow_service_role_all"
  ON public.bounty_escrow FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- bazaar_purchases
DROP POLICY IF EXISTS "purchases: service role full access" ON public.bazaar_purchases;
CREATE POLICY "purchases: service role full access"
  ON public.bazaar_purchases FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- contact_submissions: public INSERT is intentional for the marketing form.
-- Tighten admin read/update to authenticated admins only when table exists.
DO $$
BEGIN
  IF to_regclass('public.contact_submissions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin can view contact submissions" ON public.contact_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can update contact submissions" ON public.contact_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage contact submissions" ON public.contact_submissions';
    EXECUTE $p$
      CREATE POLICY "contact_submissions: admin read"
        ON public.contact_submissions FOR SELECT TO authenticated
        USING (public.is_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY "contact_submissions: admin update"
        ON public.contact_submissions FOR UPDATE TO authenticated
        USING (public.is_admin()) WITH CHECK (public.is_admin())
    $p$;
  END IF;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- â”€â”€â”€ 5. Verification queries (run manually to confirm) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'ale_usd';
-- SELECT p.proname, r.rolname FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   JOIN aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a ON true
--   JOIN pg_roles r ON r.oid = a.grantee
--  WHERE n.nspname = 'public' AND p.proname IN ('increment_wallet','purchase_bazaar_script');

-- ========== 20260531_account_status.sql ==========

-- Account status for admin ban/activate controls
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_account_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active', 'banned', 'suspended'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles (account_status);

COMMIT;

-- ========== 20260531_kinetic_scan_log_types.sql ==========

-- Operation: Kinetic Strike â€” scan_logs vocabulary + financial liability column
-- Idempotent: safe to re-run on production.

-- â”€â”€ scan_logs.type â†’ kinetic vocabulary (info, thought, strike, breach, finance) â”€â”€
DO $$
DECLARE
  con_name text;
BEGIN
  -- Drop any existing CHECK on scan_logs.type (text column or enum-backed)
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'scan_logs'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.scan_logs DROP CONSTRAINT IF EXISTS %I', con_name);
  END LOOP;
END $$;

-- Ensure type is text (handles legacy enum columns)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scan_logs'
      AND column_name = 'type'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE public.scan_logs
      ALTER COLUMN type TYPE text USING type::text;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE public.scan_logs
  ADD CONSTRAINT scan_logs_type_kinetic_check
  CHECK (type IN ('info', 'thought', 'strike', 'breach', 'finance'));

-- â”€â”€ scan_reports.financial_liability_usd (per-scan rollup) â”€â”€
ALTER TABLE public.scan_reports
  ADD COLUMN IF NOT EXISTS financial_liability_usd numeric DEFAULT NULL;

COMMENT ON COLUMN public.scan_reports.financial_liability_usd IS
  'Sum of per-breach financial_liability_usd from kinetic judge (single-incident USD).';

-- Backfill from ale_usd when kinetic column empty
UPDATE public.scan_reports
SET financial_liability_usd = ale_usd
WHERE financial_liability_usd IS NULL
  AND ale_usd IS NOT NULL;

-- audit_report_md already added in 0003_audit_enhancements.sql
ALTER TABLE public.scan_reports
  ADD COLUMN IF NOT EXISTS audit_report_md text;

-- ========== 20260601_scan_failure_reason.sql ==========

-- Operation: Key Isolation â€” persist auth failures on scans row
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS failure_reason text;

COMMENT ON COLUMN public.scans.failure_reason IS
  'Human-readable failure cause when status=failed (e.g. target API 401).';

-- ========== 20260602_blacklisted_entities.sql ==========

-- Operation: Heavy Arsenal â€” scraper trap telemetry
CREATE TABLE IF NOT EXISTS public.blacklisted_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  user_agent text,
  reason text NOT NULL DEFAULT 'scraper_detected',
  poisoned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_blacklisted_entities_ip
  ON public.blacklisted_entities (ip_address, poisoned_at DESC);

ALTER TABLE public.blacklisted_entities ENABLE ROW LEVEL SECURITY;

-- Service role writes from edge middleware; sovereign admin read
CREATE POLICY "blacklisted_entities_service_all"
  ON public.blacklisted_entities
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.blacklisted_entities IS
  'Headless scrapers served Aegis CPU trap script (forgeguard middleware).';

-- ========== 20260603_genesis30_compliance.sql ==========

-- Genesis 3.0: cookie consent + account deletion request tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cookie_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cookie_consent_version TEXT DEFAULT 'genesis-3.0',
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.cookie_consent_at IS 'When the operator accepted the cookie consent banner';
COMMENT ON COLUMN public.profiles.deletion_requested_at IS 'Soft-delete request; processed within 30 days per privacy policy';

-- ========== 20260603_kinetic_report_columns.sql ==========

-- Kinetic strike four-section report columns for scan_reports
ALTER TABLE public.scan_reports
  ADD COLUMN IF NOT EXISTS executive_summary text,
  ADD COLUMN IF NOT EXISTS technical_proof_of_concept text,
  ADD COLUMN IF NOT EXISTS remediation_code_snippet text;

COMMENT ON COLUMN public.scan_reports.executive_summary IS
  'Plain-text executive summary from DeepSeek-R1 kinetic judge';

COMMENT ON COLUMN public.scan_reports.technical_proof_of_concept IS
  'Numbered reproduction steps for the top breach finding';

COMMENT ON COLUMN public.scan_reports.remediation_code_snippet IS
  'Aegis regex or middleware snippet to block the attack vector';

-- ========== 20260603_scans_asset_value.sql ==========

-- Estimated data-access value for $ALE liability calculation
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS asset_value_usd numeric(14, 2);

COMMENT ON COLUMN public.scans.asset_value_usd IS
  'Operator-estimated USD value of data at risk; feeds kinetic $ALE judge';

-- ========== 20260604_identity_failure_reason.sql ==========

-- Identity auditor: persist last rejection reason for operator-facing UI
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_failure_reason text;

COMMENT ON COLUMN public.profiles.identity_failure_reason IS
  'Last identity auditor rejection reason (vision/DeepSeek/heuristic)';

-- ========== 20260605_identity_raw_ocr_data.sql ==========

-- Raw identity capture artifact (image path + OCR text from vision step)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_raw_ocr_data jsonb;

COMMENT ON COLUMN public.profiles.identity_raw_ocr_data IS
  'Raw capture artifact: { image_path, raw_ocr_text, mime_type, captured_at }';

-- ========== 20260606_twilio_simulation_mode.sql ==========

-- Platform flags (service-role only) â€” Twilio simulation for launch without live SMS.

CREATE TABLE IF NOT EXISTS public.platform_flags (
  key text PRIMARY KEY,
  value boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_flags: service role all" ON public.platform_flags;
CREATE POLICY "platform_flags: service role all"
  ON public.platform_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.platform_flags (key, value)
VALUES ('twilio_simulation_mode', true)
ON CONFLICT (key) DO NOTHING;

-- ========== 20260607_emergency_brain_reset.sql ==========

-- Emergency brain reset: kill stuck scans, numeric attacks_run, expanded scan_logs types
-- Idempotent where possible.

BEGIN;

-- 1. Kill all stuck/runaway scans
UPDATE public.scans
SET
  status = 'failed',
  failure_reason = 'EMERGENCY_BRAIN_RESET',
  progress_pct = 100,
  completed_at = COALESCE(completed_at, now())
WHERE status IN ('probing', 'queued');

-- 2. Fix numeric mismatch (22P02) â€” accept decimals from engine/webhook
ALTER TABLE public.scan_reports
  ADD COLUMN IF NOT EXISTS attacks_run numeric;

ALTER TABLE public.scan_reports
  ALTER COLUMN attacks_run TYPE numeric
  USING (
    CASE
      WHEN attacks_run IS NULL THEN NULL
      WHEN trim(attacks_run::text) = '' THEN NULL
      ELSE attacks_run::numeric
    END
  );

COMMENT ON COLUMN public.scan_reports.attacks_run IS
  'Total attack vectors executed (numeric for engine decimal/string payloads).';

-- 3. Expand scan_logs.type CHECK for webhook + throttle + defense
ALTER TABLE public.scan_logs DROP CONSTRAINT IF EXISTS scan_logs_type_kinetic_check;

ALTER TABLE public.scan_logs
  ADD CONSTRAINT scan_logs_type_kinetic_check
  CHECK (
    type IN (
      'info',
      'thought',
      'strike',
      'breach',
      'finance',
      'defense',
      'webhook',
      'throttle'
    )
  );

COMMIT;

-- ========== 20260608_aegis_shield_rules.sql ==========

-- Aegis Proxy shield rules (app-scoped WAF patterns for /api/v1/aegis/verify)
CREATE TABLE IF NOT EXISTS public.aegis_shield_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      text        NOT NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern     text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  action      text        NOT NULL DEFAULT 'block'
                          CHECK (action IN ('block', 'allow', 'log')),
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aegis_shield_rules_app_id
  ON public.aegis_shield_rules (app_id)
  WHERE enabled = true;

COMMENT ON TABLE public.aegis_shield_rules IS
  'Per-app prompt shield rules for Aegis Proxy verify API';

ALTER TABLE public.aegis_shield_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own aegis_shield_rules"
  ON public.aegis_shield_rules FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Writes via service role (dashboard / export sync)

-- ========== 20260608_bazaar_metadata.sql ==========

-- Sovereign Customs Agent â€” metadata blob for remediation advice + audit replay
ALTER TABLE public.bazaar_scripts
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bazaar_scripts.metadata IS
  'Sovereign Customs Agent output: remediation_advice, replay fields, audit metadata.';

CREATE INDEX IF NOT EXISTS idx_bazaar_scripts_metadata_gin
  ON public.bazaar_scripts USING gin (metadata);

-- ========== 20260609_sprint24_kinetic_bounty.sql ==========

-- Sprint 24: Kinetic bounty payout RPC + ledger tx type

ALTER TABLE public.platform_transactions
  DROP CONSTRAINT IF EXISTS platform_transactions_tx_type_check;

ALTER TABLE public.platform_transactions
  ADD CONSTRAINT platform_transactions_tx_type_check
  CHECK (tx_type IN (
    'bazaar_purchase',
    'bounty_release',
    'escrow_hold',
    'kinetic_bounty_paid',
    'top_up',
    'refund'
  ));

CREATE OR REPLACE FUNCTION public.release_kinetic_bounty(p_escrow_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.bounty_escrow%ROWTYPE;
  v_ale numeric := 0;
  v_payout numeric := 0;
BEGIN
  SELECT * INTO v_escrow
  FROM public.bounty_escrow
  WHERE id = p_escrow_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Escrow not found');
  END IF;

  IF v_escrow.status <> 'held' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Escrow is not in held status');
  END IF;

  -- Resolve ALE: submission_id may reference scan_id
  IF v_escrow.submission_id IS NOT NULL THEN
    SELECT COALESCE(sr.financial_liability_usd, sr.ale_usd, 0)
      INTO v_ale
    FROM public.scan_reports sr
    WHERE sr.scan_id = v_escrow.submission_id
    LIMIT 1;
  END IF;

  -- Fallback: highest ALE sealed scan by hacker
  IF COALESCE(v_ale, 0) <= 0 THEN
    SELECT COALESCE(sr.financial_liability_usd, sr.ale_usd, 0)
      INTO v_ale
    FROM public.scans s
    JOIN public.scan_reports sr ON sr.scan_id = s.id
    WHERE s.user_id = v_escrow.user_id
      AND s.status = 'sealed'
    ORDER BY COALESCE(sr.financial_liability_usd, sr.ale_usd, 0) DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_payout := ROUND(COALESCE(v_ale, 0) / 10.0, 2);

  IF v_payout <= 0 THEN
    v_payout := v_escrow.amount_usd;
  END IF;

  IF v_payout > v_escrow.amount_usd THEN
    v_payout := v_escrow.amount_usd;
  END IF;

  PERFORM public.increment_wallet(v_escrow.user_id, v_payout);

  UPDATE public.bounty_escrow
     SET status = 'released',
         released_at = now(),
         release_note = 'KINETIC_BOUNTY_PAID $' || v_payout::text
   WHERE id = p_escrow_id;

  INSERT INTO public.platform_transactions (
    seller_id,
    amount_usd,
    amount_credits,
    author_payout,
    platform_fee,
    tx_type
  ) VALUES (
    v_escrow.user_id,
    v_payout,
    ROUND(v_payout),
    v_payout,
    0,
    'kinetic_bounty_paid'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payout', v_payout,
    'financial_liability_usd', v_ale,
    'event', 'KINETIC_BOUNTY_PAID'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_kinetic_bounty(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_kinetic_bounty(uuid) TO service_role;

-- ========== 20260610_aegis_rule_content.sql ==========

-- Aegis Integration â€” full remediation snippet + app scope on aegis_rules

ALTER TABLE public.aegis_rules
  ADD COLUMN IF NOT EXISTS rule_content text,
  ADD COLUMN IF NOT EXISTS app_id text,
  ADD COLUMN IF NOT EXISTS finding_id text;

COMMENT ON COLUMN public.aegis_rules.rule_content IS
  'Full remediation_code_snippet from scan_reports â€” used by /api/v1/aegis/verify';

COMMENT ON COLUMN public.aegis_rules.app_id IS
  'Aegis Proxy app scope (fg-<userId prefix>) for verify API';

CREATE INDEX IF NOT EXISTS idx_aegis_rules_app_id
  ON public.aegis_rules (app_id)
  WHERE enabled = true AND app_id IS NOT NULL;

-- ========== 20260611_war_machine_leads_view.sql ==========

-- war_machine_leads â€” read alias for Marine Swarm pipeline (Agathon read-only)
CREATE OR REPLACE VIEW public.war_machine_leads AS
SELECT * FROM public.leads;

COMMENT ON VIEW public.war_machine_leads IS
  'Agathon read-only view of Marine Swarm leads; writes go through war_machine microservice';

-- ========== 20260612_hacker_wallet_payout.sql ==========

-- Sovereign ledger: hacker_wallets.credits + 10% platform fee on kinetic payout

CREATE TABLE IF NOT EXISTS public.hacker_wallets (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits    INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hacker_wallets_credits_idx ON public.hacker_wallets (credits DESC);

ALTER TABLE public.hacker_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own hacker wallet"
  ON public.hacker_wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.hacker_wallets IS
  'Researcher credit balance â€” funded by sovereign ledger payouts (post 10% fee)';

CREATE OR REPLACE FUNCTION public.increment_hacker_credits(
  p_user_id uuid,
  p_credits integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_credits <= 0 THEN
    RETURN;
  END IF;
  INSERT INTO public.hacker_wallets (user_id, credits)
  VALUES (p_user_id, p_credits)
  ON CONFLICT (user_id) DO UPDATE
    SET credits = public.hacker_wallets.credits + EXCLUDED.credits,
        updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_hacker_credits(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_hacker_credits(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.release_kinetic_bounty(p_escrow_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.bounty_escrow%ROWTYPE;
  v_ale numeric := 0;
  v_gross numeric := 0;
  v_fee numeric := 0;
  v_net numeric := 0;
  v_credits integer := 0;
BEGIN
  SELECT * INTO v_escrow
  FROM public.bounty_escrow
  WHERE id = p_escrow_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Escrow not found');
  END IF;

  IF v_escrow.status <> 'held' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Escrow is not in held status');
  END IF;

  IF v_escrow.submission_id IS NOT NULL THEN
    SELECT COALESCE(sr.financial_liability_usd, sr.ale_usd, 0)
      INTO v_ale
    FROM public.scan_reports sr
    WHERE sr.scan_id = v_escrow.submission_id
    LIMIT 1;
  END IF;

  IF COALESCE(v_ale, 0) <= 0 THEN
    SELECT COALESCE(sr.financial_liability_usd, sr.ale_usd, 0)
      INTO v_ale
    FROM public.scans s
    JOIN public.scan_reports sr ON sr.scan_id = s.id
    WHERE s.user_id = v_escrow.user_id
      AND s.status = 'sealed'
    ORDER BY COALESCE(sr.financial_liability_usd, sr.ale_usd, 0) DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_gross := ROUND(COALESCE(v_ale, 0) / 10.0, 2);

  IF v_gross <= 0 THEN
    v_gross := v_escrow.amount_usd;
  END IF;

  IF v_gross > v_escrow.amount_usd THEN
    v_gross := v_escrow.amount_usd;
  END IF;

  v_fee := ROUND(v_gross * 0.10, 2);
  v_net := ROUND(v_gross - v_fee, 2);
  v_credits := GREATEST(ROUND(v_net), 0);

  PERFORM public.increment_hacker_credits(v_escrow.user_id, v_credits);
  PERFORM public.increment_wallet(v_escrow.user_id, v_net);

  UPDATE public.bounty_escrow
     SET status = 'released',
         released_at = now(),
         release_note = 'KINETIC_BOUNTY_PAID gross=$' || v_gross::text
           || ' fee=$' || v_fee::text || ' credits=' || v_credits::text
   WHERE id = p_escrow_id;

  INSERT INTO public.platform_transactions (
    seller_id,
    amount_usd,
    amount_credits,
    author_payout,
    platform_fee,
    tx_type
  ) VALUES (
    v_escrow.user_id,
    v_gross,
    v_credits,
    v_net,
    v_fee,
    'kinetic_bounty_paid'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payout', v_net,
    'gross', v_gross,
    'platform_fee', v_fee,
    'credits', v_credits,
    'financial_liability_usd', v_ale,
    'event', 'KINETIC_BOUNTY_PAID'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_kinetic_bounty(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_kinetic_bounty(uuid) TO service_role;

-- ========== 20260613_scan_quota_limits.sql ==========

-- Align my_scan_quota with product plan limits (Free: 3, Startup: 50).

create or replace view public.my_scan_quota as
select
  s.user_id,
  s.plan,
  s.status,
  s.scans_used_this_period,
  case s.plan
    when 'free'       then 3
    when 'startup'    then 50
    when 'enterprise' then 999999
    else 3
  end as scans_allowed,
  s.period_ends_at,
  now() > coalesce(s.period_ends_at, now() + interval '1 year') as period_expired
from public.subscriptions s
where s.user_id = auth.uid();

-- ========== 20260614_target_diagnostic_logs.sql ==========

-- Persist raw target HTTP diagnostics when strikes are rejected (404 / model mismatch).

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS target_diagnostic_logs text;

COMMENT ON COLUMN public.scans.target_diagnostic_logs IS
  'Raw target HTTP response body when strikes fail (404 model not found, etc.).';

-- ========== 20260615_crypto_deposits.sql ==========

-- Legacy live table repair (address_generated / amount_usd drift) — must run before CREATE TABLE IF NOT EXISTS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crypto_deposits'
  ) THEN
    ALTER TABLE public.crypto_deposits
      ADD COLUMN IF NOT EXISTS plan_name text,
      ADD COLUMN IF NOT EXISTS plan_id text,
      ADD COLUMN IF NOT EXISTS amount_usdt numeric,
      ADD COLUMN IF NOT EXISTS deposit_address text,
      ADD COLUMN IF NOT EXISTS pay_currency text DEFAULT 'usdttrc20',
      ADD COLUMN IF NOT EXISTS payment_id text,
      ADD COLUMN IF NOT EXISTS credits_granted boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
      ADD COLUMN IF NOT EXISTS deposit_type text NOT NULL DEFAULT 'subscription',
      ADD COLUMN IF NOT EXISTS credit_amount numeric;

    UPDATE public.crypto_deposits
       SET deposit_address = COALESCE(NULLIF(deposit_address, ''), address_generated, ''),
           amount_usdt     = COALESCE(amount_usdt, amount_usd, 0),
           pay_currency    = COALESCE(NULLIF(pay_currency, ''), NULLIF(currency_type, ''), 'usdttrc20'),
           plan_name       = COALESCE(NULLIF(plan_name, ''), 'Legacy'),
           plan_id         = COALESCE(NULLIF(plan_id, ''), 'startup'),
           payment_id      = COALESCE(payment_id, tx_hash)
     WHERE deposit_address IS NULL OR deposit_address = ''
        OR amount_usdt IS NULL OR plan_name IS NULL OR plan_id IS NULL
        OR (payment_id IS NULL AND tx_hash IS NOT NULL);

    UPDATE public.crypto_deposits
       SET plan_name = COALESCE(plan_name, 'Legacy'),
           plan_id   = COALESCE(plan_id, 'startup'),
           amount_usdt = COALESCE(amount_usdt, 0),
           deposit_address = COALESCE(NULLIF(deposit_address, ''), 'legacy')
     WHERE plan_name IS NULL OR plan_id IS NULL OR amount_usdt IS NULL
        OR deposit_address IS NULL OR deposit_address = '';
  END IF;
END $$;

-- Sovereign crypto deposit rail — USDT/SOL/BTC via NOWPayments
-- When status â†’ confirmed, increment_wallet + activate subscription.

CREATE TABLE IF NOT EXISTS public.crypto_deposits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_name       text NOT NULL,
  plan_id         text NOT NULL CHECK (plan_id IN ('startup', 'enterprise')),
  amount_usdt     numeric NOT NULL CHECK (amount_usdt > 0),
  deposit_address text NOT NULL,
  pay_currency    text NOT NULL DEFAULT 'usdttrc20',
  payment_id      text,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirming', 'confirmed', 'expired', 'failed')),
  credits_granted boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  confirmed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS crypto_deposits_user_id_idx
  ON public.crypto_deposits (user_id);

CREATE INDEX IF NOT EXISTS crypto_deposits_payment_id_idx
  ON public.crypto_deposits (payment_id)
  WHERE payment_id IS NOT NULL;

ALTER TABLE public.crypto_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crypto_deposits_select_own ON public.crypto_deposits;
CREATE POLICY crypto_deposits_select_own
  ON public.crypto_deposits
  FOR SELECT
  USING (auth.uid() = user_id);

-- â”€â”€â”€ Trigger: confirmed deposit â†’ wallet + subscription â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.handle_crypto_deposit_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed')
     AND NOT NEW.credits_granted
  THEN
    PERFORM public.increment_wallet(NEW.user_id, NEW.amount_usdt);

    INSERT INTO public.subscriptions (
      user_id,
      plan,
      status,
      scans_used_this_period,
      period_starts_at,
      period_ends_at,
      updated_at
    )
    VALUES (
      NEW.user_id,
      NEW.plan_id,
      'active',
      0,
      now(),
      now() + interval '1 month',
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan                   = EXCLUDED.plan,
      status                 = 'active',
      scans_used_this_period = 0,
      period_starts_at       = now(),
      period_ends_at           = now() + interval '1 month',
      updated_at             = now();

    NEW.credits_granted := true;
    NEW.confirmed_at    := COALESCE(NEW.confirmed_at, now());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crypto_deposit_confirmed_trigger ON public.crypto_deposits;
CREATE TRIGGER crypto_deposit_confirmed_trigger
  BEFORE INSERT OR UPDATE OF status ON public.crypto_deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_crypto_deposit_confirmed();

-- ========== 20260616_crypto_deposit_type_fix.sql ==========

-- Fix double-grant: subscriptions activate plan only; credit packs increment wallet only.

ALTER TABLE public.crypto_deposits
  ADD COLUMN IF NOT EXISTS deposit_type text NOT NULL DEFAULT 'subscription';

ALTER TABLE public.crypto_deposits
  DROP CONSTRAINT IF EXISTS crypto_deposits_deposit_type_check;

ALTER TABLE public.crypto_deposits
  ADD CONSTRAINT crypto_deposits_deposit_type_check
    CHECK (deposit_type IN ('subscription', 'credit_pack'));

ALTER TABLE public.crypto_deposits
  ADD COLUMN IF NOT EXISTS credit_amount numeric;

ALTER TABLE public.crypto_deposits
  DROP CONSTRAINT IF EXISTS crypto_deposits_plan_id_check;

ALTER TABLE public.crypto_deposits
  ADD CONSTRAINT crypto_deposits_plan_id_check
    CHECK (plan_id IN ('startup', 'enterprise', 'credit_pack'));

CREATE OR REPLACE FUNCTION public.handle_crypto_deposit_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed')
     AND NOT NEW.credits_granted
  THEN
    IF NEW.deposit_type = 'credit_pack' THEN
      PERFORM public.increment_wallet(
        NEW.user_id,
        COALESCE(NEW.credit_amount, NEW.amount_usdt)
      );
    ELSE
      INSERT INTO public.subscriptions (
        user_id,
        plan,
        status,
        scans_used_this_period,
        period_starts_at,
        period_ends_at,
        updated_at
      )
      VALUES (
        NEW.user_id,
        NEW.plan_id,
        'active',
        0,
        now(),
        now() + interval '1 month',
        now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        plan                   = EXCLUDED.plan,
        status                 = 'active',
        scans_used_this_period = 0,
        period_starts_at       = now(),
        period_ends_at         = now() + interval '1 month',
        updated_at             = now();
    END IF;

    NEW.credits_granted := true;
    NEW.confirmed_at    := COALESCE(NEW.confirmed_at, now());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ========== sql\api_keys.sql ==========

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- user_api_keys
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create table if not exists public.user_api_keys (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,                  -- human-readable label
  key_prefix      text not null,                  -- first 8 chars, shown in UI (fg_a1b2c3d4â€¦)
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

-- â”€â”€ Row Level Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.user_api_keys enable row level security;

-- Users can only see their own keys
DROP POLICY IF EXISTS "users see own keys" ON public.user_api_keys;
CREATE POLICY "users see own keys"
  ON public.user_api_keys FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users create own keys" ON public.user_api_keys;
CREATE POLICY "users create own keys"
  ON public.user_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users revoke own keys" ON public.user_api_keys;
CREATE POLICY "users revoke own keys"
  ON public.user_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

-- Deletion is disallowed â€” soft-revoke via revoked_at instead
-- (no delete policy)

-- â”€â”€ Comments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
comment on table  public.user_api_keys is 'Hashed API keys for programmatic/CI-CD access';
comment on column public.user_api_keys.key_prefix  is 'First 8 chars of raw key for UI display (e.g. fg_a1b2c3)';
comment on column public.user_api_keys.key_hash    is 'SHA-256 hex of the full raw key â€” never store the raw key';
comment on column public.user_api_keys.revoked_at  is 'Set to revoke; NULL means active';

-- ========== sql\scheduled_scans.sql ==========

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- scheduled_scans
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Persists recurring scan configurations. A Supabase Edge Function
-- (run-scheduled-scans) runs on a pg_cron schedule and:
--   1. Selects rows where next_run_at <= now() AND active = true
--   2. Inserts a new scan row (copying target_* and credential)
--   3. Updates last_run_at and next_run_at
--
-- Frequencies
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--   'daily'   â†’ next_run_at += interval '1 day'
--   'weekly'  â†’ next_run_at += interval '7 days'
--   'monthly' â†’ next_run_at += interval '30 days'
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DO $$ BEGIN
  CREATE TYPE scheduled_scan_frequency AS ENUM ('daily', 'weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.scheduled_scans (
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

-- â”€â”€ Row Level Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.scheduled_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own schedules" ON public.scheduled_scans;
CREATE POLICY "users manage own schedules"
  ON public.scheduled_scans
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ Comments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
comment on table  public.scheduled_scans is 'Recurring scan configurations, driven by pg_cron + Edge Function';
comment on column public.scheduled_scans.target_credential_encrypted is 'AES-GCM sealed copy of the target API key, same scheme as scans table';
comment on column public.scheduled_scans.next_run_at is 'When the next scan should fire; updated by the cron runner after each run';

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- pg_cron setup (run once with superuser / postgres role)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Uncomment and run this in the Supabase SQL editor (not in migrations,
-- because pg_cron extension must be enabled first via Dashboard â†’ Extensions):
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

-- ========== verify-live-schema.sql ==========

-- Live schema verification (Dashboard Crash Recovery)
-- Run in Supabase SQL Editor for project nlginrukltrwpkyujzzx

SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'ale_usd'
ORDER BY table_name;

SELECT column_name, table_name
FROM information_schema.columns
WHERE table_name IN ('profiles', 'user_wallets', 'subscriptions', 'bazaar_purchases')
  AND column_name IN ('hacker_rank', 'balance_usd', 'is_frozen', 'plan', 'status', 'author_id')
ORDER BY table_name, column_name;

SELECT p.proname, r.rolname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a ON true
JOIN pg_roles r ON r.oid = a.grantee
WHERE n.nspname = 'public'
  AND p.proname IN ('increment_wallet', 'purchase_bazaar_script', 'increment_purchase')
ORDER BY p.proname, r.rolname;

SELECT id FROM storage.buckets WHERE id = 'verification-docs';

SELECT to_regclass('public.verification_otps') AS verification_otps,
       to_regclass('public.otp_logs') AS otp_logs;
