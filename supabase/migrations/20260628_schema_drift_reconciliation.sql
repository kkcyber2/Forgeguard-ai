-- 20260628_schema_drift_reconciliation.sql
-- Align the live Supabase DB to the frontend + migrations after schema drift.
-- The live DB had diverged from the migrations folder in both directions:
--   * missing tables/columns the frontend expects (enterprise_api_keys, hacker_repos
--     tags/code/version/commit_count, repo_files frontend columns, subscriptions
--     ls_variant_id/ls_order_id/period_starts_at)
--   * an out-of-band repo_files rename (file_path/storage_path) no migration recorded
--   * profiles.hacker_rank integer vs the frontend's string-enum contract
-- Idempotent; safe to re-run. Aligned with the user-approved "align DB" strategy.

-- ── 1. enterprise_api_keys (defined in 20260518, missing on live) ──────────────
CREATE TABLE IF NOT EXISTS public.enterprise_api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      text NOT NULL,
  api_key     text NOT NULL UNIQUE,
  plan        text NOT NULL DEFAULT 'starter'
              CHECK (plan IN ('starter','professional','enterprise','admin')),
  is_active   boolean NOT NULL DEFAULT true,
  hit_count   integer NOT NULL DEFAULT 0,
  last_hit    timestamptz,
  expires_at  timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.enterprise_api_keys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "api_keys: service role only"
    ON public.enterprise_api_keys FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS idx_enterprise_api_keys_key    ON public.enterprise_api_keys (api_key);
CREATE INDEX IF NOT EXISTS idx_enterprise_api_keys_org    ON public.enterprise_api_keys (org_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_api_keys_active ON public.enterprise_api_keys (is_active, expires_at);

-- ── 2. hacker_repos: add tags/code/version/commit_count (from 20260518) ────────
DO $$ BEGIN ALTER TABLE public.hacker_repos ADD COLUMN tags text[] NOT NULL DEFAULT '{}';        EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.hacker_repos ADD COLUMN code text NOT NULL DEFAULT '';            EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.hacker_repos ADD COLUMN version text NOT NULL DEFAULT '1.0.0';    EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.hacker_repos ADD COLUMN commit_count integer NOT NULL DEFAULT 1;  EXCEPTION WHEN duplicate_column THEN null; END $$;
-- Preserve legacy content in the new code column where empty.
UPDATE public.hacker_repos SET code = code_content WHERE (code IS NULL OR code = '') AND code_content IS NOT NULL;
-- Allow frontend inserts that omit the legacy script_name column.
ALTER TABLE public.hacker_repos ALTER COLUMN script_name SET DEFAULT '';

-- ── 3. repo_files: rename file_path→path, storage_path→storage_key; add FE cols ─
DO $$ BEGIN ALTER TABLE public.repo_files RENAME COLUMN file_path TO path;       EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.repo_files RENAME COLUMN storage_path TO storage_key; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.repo_files ADD COLUMN user_id uuid;                       EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.repo_files ADD COLUMN name text NOT NULL DEFAULT '';       EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.repo_files ADD COLUMN size_bytes integer NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.repo_files ADD COLUMN mime_type text NOT NULL DEFAULT 'text/plain'; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.repo_files ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();  EXCEPTION WHEN duplicate_column THEN null; END $$;
-- Backfill user_id from the owning repo's owner_id so RLS-style filters match.
UPDATE public.repo_files rf SET user_id = hr.owner_id
  FROM public.hacker_repos hr WHERE rf.repo_id = hr.id AND rf.user_id IS NULL;
-- Backfill name from the path basename where empty.
UPDATE public.repo_files
  SET name = split_part(path, '/', array_length(string_to_array(path, '/'), 1))
  WHERE name = '' AND path IS NOT NULL;
DO $$ BEGIN ALTER TABLE public.repo_files ADD CONSTRAINT repo_files_repo_path_key UNIQUE (repo_id, path); EXCEPTION WHEN duplicate_table THEN null; END $$;

-- ── 4. subscriptions: add ls_variant_id, ls_order_id, period_starts_at (0003) ──
DO $$ BEGIN ALTER TABLE public.subscriptions ADD COLUMN ls_variant_id text;                          EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.subscriptions ADD COLUMN ls_order_id text;                            EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE public.subscriptions ADD COLUMN period_starts_at timestamptz NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN null; END $$;

-- ── 5. target_verifications: relax NOT NULL so FE upserts (omit target_url + verification_token) succeed
ALTER TABLE public.target_verifications ALTER COLUMN target_url DROP NOT NULL;
ALTER TABLE public.target_verifications ALTER COLUMN verification_token DROP NOT NULL;

-- ── 6. bazaar_scripts.author_id: set NOT NULL (verified 0 nulls) ───────────────
ALTER TABLE public.bazaar_scripts ALTER COLUMN author_id SET NOT NULL;

-- ── 7. profiles.hacker_rank: integer → text enum labels (frontend contract) ────
-- Three views depend on this column; drop, alter, recreate (none had RLS/policies).
DROP VIEW IF EXISTS public.visible_profiles;
DROP VIEW IF EXISTS public.profiles_with_rank;
DROP VIEW IF EXISTS public.profiles_public;

ALTER TABLE public.profiles ALTER COLUMN hacker_rank DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN hacker_rank TYPE text
  USING CASE
    WHEN hacker_rank IS NULL THEN NULL
    WHEN hacker_rank = 99   THEN 'LEGEND'
    WHEN hacker_rank = 0    THEN 'RECRUIT'
    ELSE 'RECRUIT'
  END;
ALTER TABLE public.profiles ALTER COLUMN hacker_rank SET DEFAULT 'RECRUIT';

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id, full_name, hacker_rank, is_ghost_active, company_tag, domain_verified,
       company_domain, work_email_verified, identity_verified, sovereign_pending,
       clearance_tier, reputation, bio, avatar_url, job_title, created_at
FROM profiles;

CREATE OR REPLACE VIEW public.visible_profiles AS
SELECT id,
       CASE WHEN is_ghost_active THEN ('OPERATOR_'::text || "substring"((id)::text, 1, 8))
            ELSE full_name END AS display_name,
       hacker_rank, clearance_tier
FROM profiles;

CREATE OR REPLACE VIEW public.profiles_with_rank AS
SELECT id, email, full_name, company_name, phone, avatar_url, role, is_verified,
       created_at, updated_at, entitlements, scans_used_this_period, period_resets_at,
       is_admin, current_plan, reputation, hacker_rank, user_type, domain_verified,
       access_level, job_title, identity_status, verification_data, identity_verified,
       company_tag, bio, phone_number, profile_completeness, theme_preference,
       clearance_tier, ai_audit_score, active_view_mode, phone_verified,
       identity_document_path, identity_audit_score, identity_audit_status,
       identity_audit_notes, sovereign_pending, signature_data, trust_score,
       company_domain, current_persona, domain_token, subscription_tier,
       is_ghost_active, domain_verify_token, identity_proofed, is_banned, banned_until,
       deleted_at, account_status, data_processing_agreed, deletion_requested_at,
       cookie_consent_at, identity_failure_reason, sovereign_manual_verify,
       identity_raw_ocr_data, manual_verification_override, twilio_simulation_mode,
       last_billing_sync_at, revenue_simulation_mode, stripe_customer_id, signature_at,
       cookie_consent_version,
       CASE WHEN reputation >= 1000 THEN 'Legend'::text
            WHEN reputation >= 100  THEN 'Elite'::text
            ELSE 'Recruit'::text END AS rank_label,
       CASE WHEN reputation >= 1000 THEN LEAST(100::numeric, ((reputation - 1000)::numeric / 9000::numeric) * 100::numeric)
            WHEN reputation >= 100  THEN ((reputation - 100)::numeric / 900::numeric) * 100::numeric
            ELSE (reputation::numeric / 100::numeric) * 100::numeric END AS rank_progress,
       CASE WHEN reputation >= 1000 THEN 10000
            WHEN reputation >= 100  THEN 1000
            ELSE 100 END AS rank_ceiling
FROM profiles p;
