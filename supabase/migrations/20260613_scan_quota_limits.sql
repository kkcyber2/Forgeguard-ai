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
