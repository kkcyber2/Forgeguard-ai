-- Compartment Zero — agency compartment schema + black-hole telemetry
-- Migration: 20260710_agency_compartment.sql

-- ─── Black-hole telemetry (honeypot sink) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.black_hole_telemetry (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address   TEXT NOT NULL,
  user_agent   TEXT,
  reason       TEXT NOT NULL,
  path         TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS black_hole_telemetry_recorded_idx
  ON public.black_hole_telemetry (recorded_at DESC);
CREATE INDEX IF NOT EXISTS black_hole_telemetry_ip_idx
  ON public.black_hole_telemetry (ip_address, recorded_at DESC);

ALTER TABLE public.black_hole_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS black_hole_telemetry_service_all ON public.black_hole_telemetry;
CREATE POLICY black_hole_telemetry_service_all ON public.black_hole_telemetry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.black_hole_telemetry IS
  'Honeypot trap telemetry — service_role writes only; no client reads.';

-- ─── Intel vault query_type expansion ───────────────────────────────────────
ALTER TABLE public.intel_vault_queries DROP CONSTRAINT IF EXISTS intel_vault_queries_query_type_check;
ALTER TABLE public.intel_vault_queries ADD CONSTRAINT intel_vault_queries_query_type_check
  CHECK (query_type IN ('dns', 'whois', 'certs', 'robots', 'security_txt', 'headers', 'ct_logs', 'subdomains'));

ALTER TABLE public.intel_vault_results DROP CONSTRAINT IF EXISTS intel_vault_results_query_type_check;
ALTER TABLE public.intel_vault_results ADD CONSTRAINT intel_vault_results_query_type_check
  CHECK (query_type IN ('dns', 'whois', 'certs', 'robots', 'security_txt', 'headers', 'ct_logs', 'subdomains'));

-- ─── Default compartment ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agency_compartments (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.agency_compartments (id, name, slug)
VALUES ('00000000-0000-4000-8000-000000000001', 'Compartment Zero', 'compartment-zero')
ON CONFLICT (id) DO NOTHING;

-- ─── Agency members ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agency_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compartment_id  UUID NOT NULL REFERENCES public.agency_compartments (id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'analyst'
    CHECK (role IN ('commander', 'analyst', 'viewer')),
  invited_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (compartment_id, user_id)
);

CREATE INDEX IF NOT EXISTS agency_members_user_idx ON public.agency_members (user_id);

-- ─── Cases ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agency_cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compartment_id  UUID NOT NULL REFERENCES public.agency_compartments (id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'active', 'closed', 'archived')),
  priority        TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  target_domain   TEXT,
  created_by      UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  assignee_id     UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_cases_compartment_idx
  ON public.agency_cases (compartment_id, updated_at DESC);

-- ─── Entities ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agency_entities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compartment_id  UUID NOT NULL REFERENCES public.agency_compartments (id) ON DELETE CASCADE,
  case_id         UUID REFERENCES public.agency_cases (id) ON DELETE SET NULL,
  entity_type     TEXT NOT NULL
    CHECK (entity_type IN ('domain', 'subdomain', 'ip', 'email', 'url', 'hash', 'org', 'person')),
  value           TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'fusion',
  confidence      NUMERIC(4,3) NOT NULL DEFAULT 0.500
    CHECK (confidence >= 0 AND confidence <= 1),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (compartment_id, entity_type, value)
);

CREATE INDEX IF NOT EXISTS agency_entities_case_idx ON public.agency_entities (case_id);
CREATE INDEX IF NOT EXISTS agency_entities_value_idx ON public.agency_entities (value);

-- ─── Entity links ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agency_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compartment_id    UUID NOT NULL REFERENCES public.agency_compartments (id) ON DELETE CASCADE,
  source_entity_id  UUID NOT NULL REFERENCES public.agency_entities (id) ON DELETE CASCADE,
  target_entity_id  UUID NOT NULL REFERENCES public.agency_entities (id) ON DELETE CASCADE,
  relationship      TEXT NOT NULL DEFAULT 'related_to',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_entity_id, target_entity_id, relationship)
);

-- ─── Watchlists ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agency_watchlists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compartment_id  UUID NOT NULL REFERENCES public.agency_compartments (id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  created_by      UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agency_watchlist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id  UUID NOT NULL REFERENCES public.agency_watchlists (id) ON DELETE CASCADE,
  entity_id     UUID REFERENCES public.agency_entities (id) ON DELETE SET NULL,
  raw_value     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Tasks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agency_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compartment_id  UUID NOT NULL REFERENCES public.agency_compartments (id) ON DELETE CASCADE,
  case_id         UUID REFERENCES public.agency_cases (id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  assignee_id     UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  due_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Audit events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agency_audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compartment_id  UUID NOT NULL REFERENCES public.agency_compartments (id) ON DELETE CASCADE,
  actor_id        UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  action          TEXT NOT NULL,
  target_type     TEXT,
  target_id       UUID,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_audit_compartment_idx
  ON public.agency_audit_events (compartment_id, created_at DESC);

-- ─── Membership helper (SECURITY DEFINER) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_agency_member(p_compartment_id UUID DEFAULT '00000000-0000-4000-8000-000000000001')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_members m
    WHERE m.compartment_id = p_compartment_id
      AND m.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_agency_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_agency_member(UUID) TO authenticated;

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.agency_compartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_compartments_member_select ON public.agency_compartments;
CREATE POLICY agency_compartments_member_select ON public.agency_compartments
  FOR SELECT TO authenticated USING (public.is_agency_member(id));

DROP POLICY IF EXISTS agency_members_member_select ON public.agency_members;
CREATE POLICY agency_members_member_select ON public.agency_members
  FOR SELECT TO authenticated USING (public.is_agency_member(compartment_id));

DROP POLICY IF EXISTS agency_members_commander_insert ON public.agency_members;
CREATE POLICY agency_members_commander_insert ON public.agency_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_agency_member(compartment_id)
    AND EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.compartment_id = agency_members.compartment_id
        AND m.user_id = auth.uid()
        AND m.role = 'commander'
    )
  );

DROP POLICY IF EXISTS agency_cases_member_all ON public.agency_cases;
CREATE POLICY agency_cases_member_all ON public.agency_cases
  FOR ALL TO authenticated
  USING (public.is_agency_member(compartment_id))
  WITH CHECK (public.is_agency_member(compartment_id));

DROP POLICY IF EXISTS agency_entities_member_all ON public.agency_entities;
CREATE POLICY agency_entities_member_all ON public.agency_entities
  FOR ALL TO authenticated
  USING (public.is_agency_member(compartment_id))
  WITH CHECK (public.is_agency_member(compartment_id));

DROP POLICY IF EXISTS agency_links_member_all ON public.agency_links;
CREATE POLICY agency_links_member_all ON public.agency_links
  FOR ALL TO authenticated
  USING (public.is_agency_member(compartment_id))
  WITH CHECK (public.is_agency_member(compartment_id));

DROP POLICY IF EXISTS agency_watchlists_member_all ON public.agency_watchlists;
CREATE POLICY agency_watchlists_member_all ON public.agency_watchlists
  FOR ALL TO authenticated
  USING (public.is_agency_member(compartment_id))
  WITH CHECK (public.is_agency_member(compartment_id));

DROP POLICY IF EXISTS agency_watchlist_items_member_all ON public.agency_watchlist_items;
CREATE POLICY agency_watchlist_items_member_all ON public.agency_watchlist_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_watchlists w
      WHERE w.id = agency_watchlist_items.watchlist_id
        AND public.is_agency_member(w.compartment_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_watchlists w
      WHERE w.id = agency_watchlist_items.watchlist_id
        AND public.is_agency_member(w.compartment_id)
    )
  );

DROP POLICY IF EXISTS agency_tasks_member_all ON public.agency_tasks;
CREATE POLICY agency_tasks_member_all ON public.agency_tasks
  FOR ALL TO authenticated
  USING (public.is_agency_member(compartment_id))
  WITH CHECK (public.is_agency_member(compartment_id));

DROP POLICY IF EXISTS agency_audit_member_select ON public.agency_audit_events;
CREATE POLICY agency_audit_member_select ON public.agency_audit_events
  FOR SELECT TO authenticated USING (public.is_agency_member(compartment_id));

DROP POLICY IF EXISTS agency_audit_member_insert ON public.agency_audit_events;
CREATE POLICY agency_audit_member_insert ON public.agency_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_agency_member(compartment_id) AND actor_id = auth.uid());

-- ─── Leads: agency members only ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can read leads" ON public.leads;
DROP POLICY IF EXISTS leads_agency_member_select ON public.leads;
CREATE POLICY leads_agency_member_select ON public.leads
  FOR SELECT TO authenticated
  USING (public.is_agency_member());
