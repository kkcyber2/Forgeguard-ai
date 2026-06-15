-- Resolve Supabase security advisor ERROR: security_definer_view (4 views).
-- Recreate with security_invoker = true so RLS applies as the querying role.

CREATE OR REPLACE VIEW public.my_scan_quota
WITH (security_invoker = true)
AS
SELECT
  s.user_id,
  s.plan,
  s.status,
  s.scans_used_this_period,
  CASE s.plan
    WHEN 'free'       THEN 3
    WHEN 'startup'    THEN 50
    WHEN 'enterprise' THEN 999999
    ELSE 3
  END AS scans_allowed,
  s.period_ends_at,
  now() > coalesce(s.period_ends_at, now() + interval '1 year') AS period_expired
FROM public.subscriptions s
WHERE s.user_id = auth.uid();

DROP VIEW IF EXISTS public.profiles_with_rank;

CREATE VIEW public.profiles_with_rank
WITH (security_invoker = true)
AS
SELECT
  p.*,
  CASE
    WHEN p.reputation >= 1000 THEN 'Legend'
    WHEN p.reputation >= 100  THEN 'Elite'
    ELSE                           'Recruit'
  END AS rank_label,
  CASE
    WHEN p.reputation >= 1000 THEN
      LEAST(100, ((p.reputation - 1000)::numeric / 9000) * 100)
    WHEN p.reputation >= 100 THEN
      ((p.reputation - 100)::numeric / 900) * 100
    ELSE
      (p.reputation::numeric / 100) * 100
  END AS rank_progress,
  CASE
    WHEN p.reputation >= 1000 THEN 10000
    WHEN p.reputation >= 100  THEN 1000
    ELSE                           100
  END AS rank_ceiling
FROM public.profiles p;

DROP VIEW IF EXISTS public.intel_messages_with_profile;

CREATE VIEW public.intel_messages_with_profile
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.user_id,
  m.content,
  m.created_at,
  COALESCE(p.full_name, 'Anonymous') AS display_name
FROM public.intel_messages m
LEFT JOIN public.profiles p ON p.id = m.user_id;

DROP VIEW IF EXISTS public.war_machine_leads;

CREATE VIEW public.war_machine_leads
WITH (security_invoker = true)
AS
SELECT * FROM public.leads;

COMMENT ON VIEW public.war_machine_leads IS
  'Agathon read-only view of Marine Swarm leads; writes go through war_machine microservice';
