-- Trust & Tags v2: optional work-email tier after domain DNS proof
alter table public.profiles
  add column if not exists work_email_verified boolean not null default false;

comment on column public.profiles.work_email_verified is
  'True when auth email matches company_domain after domain_verified.';
