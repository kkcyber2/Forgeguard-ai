-- Phase 1 trust: scan scope enforcement — record the verified host on each scan.
-- ForgeGuard AI — 2026-07-04
-- createScan stores the ownership-verified host (apex) the target was proven
-- to sit within. scope_verified_at is set when the scope gate passed.

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS scope_host        text,
  ADD COLUMN IF NOT EXISTS scope_verified_at timestamptz;

COMMENT ON COLUMN scans.scope_host        IS 'Normalized verified host (apex) the scan target was proven within';
COMMENT ON COLUMN scans.scope_verified_at IS 'Timestamp the scope gate passed (null for recon/standard)';

CREATE INDEX IF NOT EXISTS idx_scans_scope_host
  ON scans (scope_host)
  WHERE scope_host IS NOT NULL;
