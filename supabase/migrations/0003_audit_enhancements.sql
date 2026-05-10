-- ============================================================
-- Migration 0003: Audit Report Enhancements
-- ============================================================
-- 1. Add full Markdown audit report column to scan_reports
-- 2. Add indirect_prompt_injection OWASP family note (comment)
-- 3. Add subscriptions table for LemonSqueezy payment gating
-- ============================================================

-- ── 1. audit_report_md on scan_reports ──────────────────────────────────────
-- Full structured Markdown report built by agathon/reporter.py at seal time.
-- Rendered in the dashboard using a rich Markdown renderer (findings-report.tsx).
alter table public.scan_reports
  add column if not exists audit_report_md text;

-- ── 2. subscriptions table (LemonSqueezy) ───────────────────────────────────
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
-- Client-side writes are blocked — all mutations go through the webhook.
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

-- ── 3. Ensure every new user gets a free plan row ───────────────────────────
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

-- ── 4. Scan-limit helper view ────────────────────────────────────────────────
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

-- ── Index for webhook lookups by LS subscription ID ─────────────────────────
create index if not exists subscriptions_ls_id_idx
  on public.subscriptions (ls_subscription_id)
  where ls_subscription_id is not null;
