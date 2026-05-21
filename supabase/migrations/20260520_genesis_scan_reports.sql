-- ============================================================
-- ForgeGuard AI — Genesis Intelligence Pipeline
-- Sprint: Total System Integration
-- Date:   2026-05-20
--
-- Adds four columns to scan_reports for the Elite 8 pipeline output:
--   discovery_report  JSONB  — full attack-surface map from DiscoveryEngine
--   ale_usd           FLOAT  — Projected Annual Loss Expectancy ($ALE) from RiskQuantifier
--   social_templates  JSONB  — phishing/vishing training templates from SocialSwarm
--   aegis_zip_b64     TEXT   — base64 Aegis Rule Bundle ZIP from PatchGenerator
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
