-- ─────────────────────────────────────────────────────────────────────────────
-- War Machine — leads table
-- Migration: 20260518_war_machine_leads.sql
--
-- Tracks every scraped lead through the full outreach pipeline:
--   new → emailed → clicked → responded → converted
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company identity
  company_name   TEXT        NOT NULL,
  website_url    TEXT        UNIQUE,          -- used for upsert dedup
  founder_name   TEXT,
  email          TEXT,
  description    TEXT,

  -- Source metadata
  source         TEXT        NOT NULL DEFAULT 'manual'
                               CHECK (source IN ('yc', 'producthunt', 'x', 'manual')),
  batch          TEXT,                        -- e.g. 'W24', 'S23' (YC only)

  -- Marineford rank
  rank           TEXT        NOT NULL DEFAULT 'Recruit'
                               CHECK (rank IN ('Recruit', 'Lieutenant', 'Admiral')),

  -- AI-generated content
  scare_hook     TEXT,
  vulnerability  TEXT,
  subject_line   TEXT,

  -- Outreach status
  status         TEXT        NOT NULL DEFAULT 'new'
                               CHECK (status IN ('new','emailed','clicked','responded','converted','bounced','unsubscribed')),

  -- Click tracking (UUID generated on insert — share in email links)
  click_token    UUID        NOT NULL DEFAULT gen_random_uuid(),

  -- Timestamps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  emailed_at     TIMESTAMPTZ,
  clicked_at     TIMESTAMPTZ,
  responded_at   TIMESTAMPTZ,

  -- Resend message ID for delivery tracking
  resend_msg_id  TEXT
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS leads_status_idx        ON public.leads (status);
CREATE INDEX IF NOT EXISTS leads_click_token_idx   ON public.leads (click_token);
CREATE INDEX IF NOT EXISTS leads_source_idx        ON public.leads (source);
CREATE INDEX IF NOT EXISTS leads_created_at_idx    ON public.leads (created_at DESC);

-- ─── RLS (service role bypasses; restrict anon/auth reads) ───────────────────
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Only service role (war machine Python scripts) can read/write
-- No policies for anon or authenticated — this table is internal only
-- The click-tracking route uses the service role key server-side

-- ─── Admin read policy (optional: let admin dashboard query leads) ────────────
CREATE POLICY "Admin can read leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.access_level >= 4
    )
  );

-- ─── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE  public.leads                IS 'War Machine outreach pipeline — scraped leads from YC, Product Hunt, and X';
COMMENT ON COLUMN public.leads.click_token    IS 'UUID embedded in cold email CTA links; clicking marks status=clicked';
COMMENT ON COLUMN public.leads.scare_hook     IS 'AI-generated 2-sentence vulnerability hook sent in the email';
COMMENT ON COLUMN public.leads.vulnerability  IS 'Short name of the identified vulnerability (e.g. Prompt Injection)';
COMMENT ON COLUMN public.leads.rank           IS 'Marineford rank: Recruit (cold), Lieutenant (seed-stage), Admiral (Series A+)';
