-- ============================================================
-- Phase 5 — Data Moat: EPSS + CVSS v3 enrichment on the Almanac
-- ForgeGuard AI — 2026-06-27
-- ============================================================
-- The Almanac already ingests CISA KEV + scan findings. This adds
-- quantitative prioritization columns (EPSS exploit likelihood +
-- CVSS v3 base score/severity) so entries can be ranked, and an
-- NVD-published timestamp for the new NVD ingest source.
--
-- All columns are nullable so existing rows and the scan-ingest
-- path continue to work unchanged.
-- ============================================================

ALTER TABLE public.vulnerability_almanac_entries
  ADD COLUMN IF NOT EXISTS epss_score      double precision,
  ADD COLUMN IF NOT EXISTS epss_percentile double precision,
  ADD COLUMN IF NOT EXISTS cvss_v3_score   double precision,
  ADD COLUMN IF NOT EXISTS cvss_severity   text,
  ADD COLUMN IF NOT EXISTS nvd_published   timestamptz;

COMMENT ON COLUMN public.vulnerability_almanac_entries.epss_score      IS 'Phase 5: EPSS exploit likelihood score (0..1) from First.org';
COMMENT ON COLUMN public.vulnerability_almanac_entries.epss_percentile IS 'Phase 5: EPSS percentile (0..1) — higher = more likely exploited';
COMMENT ON COLUMN public.vulnerability_almanac_entries.cvss_v3_score   IS 'Phase 5: CVSS v3.1 base score (0..10) from NVD/KEV';
COMMENT ON COLUMN public.vulnerability_almanac_entries.cvss_severity   IS 'Phase 5: CVSS v3 base severity (LOW/MEDIUM/HIGH/CRITICAL)';
COMMENT ON COLUMN public.vulnerability_almanac_entries.nvd_published   IS 'Phase 5: NVD publication date for CVE-source entries';

-- Loosen the source_type check: NVD ingest writes source_type='nvd'.
-- (No CHECK constraint existed before; keep it permissive.)
CREATE INDEX IF NOT EXISTS idx_almanac_cve_id
  ON public.vulnerability_almanac_entries (cve_id)
  WHERE cve_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_almanac_epss
  ON public.vulnerability_almanac_entries (epss_percentile DESC NULLS LAST)
  WHERE merged_into_id IS NULL;
