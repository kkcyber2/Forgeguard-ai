-- Phase 1 trust: immutable audit trail — hash-chained scan lifecycle events.
-- ForgeGuard AI — 2026-07-04
-- Each row's event_hash = sha256(prev_hash || event || scan_id || created_at).
-- Inserts only via the service role (server). UPDATE/DELETE revoked from
-- authenticated so the chain is tamper-evident under RLS.

CREATE TABLE IF NOT EXISTS public.scan_audit_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       uuid        NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL,
  event         text        NOT NULL,   -- scope_verified | scan_started | first_finding | scan_sealed
  policy_version text,
  event_hash    text        NOT NULL,   -- sha256(prev_hash || event || scan_id || created_at)
  prev_hash     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_audit_events ENABLE ROW LEVEL SECURITY;

-- Users may read only their own scan audit events.
CREATE POLICY scan_audit_select_own
  ON public.scan_audit_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy for `authenticated` → inserts must come via
-- the service role (server), and rows can never be modified or deleted.
REVOKE UPDATE, DELETE ON public.scan_audit_events FROM authenticated;

CREATE INDEX IF NOT EXISTS scan_audit_scan_idx
  ON public.scan_audit_events (scan_id, created_at);
