-- ============================================================
-- Phase 3 — Aegis closed-loop: aegis_rules schema alignment + proof cols
-- ForgeGuard AI — 2026-07-04
-- ============================================================
-- The live aegis_rules table pre-dated the sprint9 migration shape
-- (20260517_sprint9_aegis_intel.sql). It was missing the canonical columns
-- the rule generators (src/lib/aegis/ruleset-core.ts) and auto-evolve
-- (src/lib/evolve/aegis-auto-export.ts) write. This migration adds those
-- columns alongside the Phase 3 closed-loop proof columns, without dropping
-- the legacy columns (rule_name, pattern_to_block, is_active, user_id).
-- ============================================================

ALTER TABLE public.aegis_rules
  ADD COLUMN IF NOT EXISTS scan_id      uuid REFERENCES scans (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS rule_id      text,
  ADD COLUMN IF NOT EXISTS pattern      text,
  ADD COLUMN IF NOT EXISTS description  text,
  ADD COLUMN IF NOT EXISTS action       text,
  ADD COLUMN IF NOT EXISTS format       text NOT NULL DEFAULT 'cloudflare',
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS verified_blocks_attack boolean,
  ADD COLUMN IF NOT EXISTS cloudflare_rule_id text;

COMMENT ON COLUMN public.aegis_rules.scan_id                IS 'Scan the rule was generated from (FK scans.id)';
COMMENT ON COLUMN public.aegis_rules.rule_id                IS 'Stable ref fg-aegis-<technique>-<ts36>; upsert key for auto-evolve';
COMMENT ON COLUMN public.aegis_rules.pattern                IS 'Cloudflare WAF expression (≤500 chars)';
COMMENT ON COLUMN public.aegis_rules.verified_blocks_attack IS 'Phase 3 closed-loop: rule proven to block the finding payload (local deterministic proof)';
COMMENT ON COLUMN public.aegis_rules.cloudflare_rule_id     IS 'Phase 3E: Cloudflare ruleset id returned after a successful apply';

CREATE INDEX IF NOT EXISTS idx_aegis_rules_scan_id
  ON public.aegis_rules (scan_id);

-- Unique upsert target for auto-evolve (allows legacy rows with NULL rule_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_aegis_rules_rule_id
  ON public.aegis_rules (rule_id)
  WHERE rule_id IS NOT NULL;
