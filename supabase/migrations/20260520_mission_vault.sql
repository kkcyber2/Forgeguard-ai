-- =============================================================
-- Mission Vault — Stronghold 2.0
-- Tables: missions, mission_proposals, mission_messages
-- =============================================================

-- ── 1. missions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.missions (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             text         NOT NULL,
  description       text         NOT NULL,
  scope             text,                        -- target scope / rules of engagement
  budget_credits    integer      NOT NULL DEFAULT 0,
  required_rank     text         NOT NULL DEFAULT 'RECRUIT', -- RECRUIT | OPERATIVE | ELITE | SOVEREIGN
  company_tag       text,                        -- e.g. "GOOGLE SEC" shown as badge
  domain_verified   boolean      NOT NULL DEFAULT false,
  status            text         NOT NULL DEFAULT 'open', -- open | in_progress | completed | cancelled
  selected_hacker_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Clients can insert their own missions
CREATE POLICY "missions_insert_own" ON public.missions
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Everyone (authenticated) can read open missions
CREATE POLICY "missions_select_open" ON public.missions
  FOR SELECT TO authenticated
  USING (status = 'open' OR client_id = auth.uid() OR selected_hacker_id = auth.uid());

-- Clients can update their own missions
CREATE POLICY "missions_update_own" ON public.missions
  FOR UPDATE TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_missions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER missions_set_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.set_missions_updated_at();

-- ── 2. mission_proposals ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mission_proposals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid        NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  hacker_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pitch       text        NOT NULL,
  timeline    text,                        -- e.g. "2–3 days"
  ask_credits integer     NOT NULL DEFAULT 0,
  status      text        NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, hacker_id)
);

ALTER TABLE public.mission_proposals ENABLE ROW LEVEL SECURITY;

-- Hackers can submit proposals
CREATE POLICY "proposals_insert_own" ON public.mission_proposals
  FOR INSERT TO authenticated
  WITH CHECK (hacker_id = auth.uid());

-- Hackers see their own; clients see proposals on their missions
CREATE POLICY "proposals_select" ON public.mission_proposals
  FOR SELECT TO authenticated
  USING (
    hacker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_id AND m.client_id = auth.uid()
    )
  );

-- Clients can accept/reject proposals on their missions
CREATE POLICY "proposals_update_client" ON public.mission_proposals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_id AND m.client_id = auth.uid()
    )
  );

-- ── 3. mission_messages (Realtime DM) ───────────────────────
CREATE TABLE IF NOT EXISTS public.mission_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid        NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sender_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_messages ENABLE ROW LEVEL SECURITY;

-- Only mission participants (client + selected hacker) can read/write messages
CREATE POLICY "messages_select" ON public.mission_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_id
        AND (m.client_id = auth.uid() OR m.selected_hacker_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert" ON public.mission_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_id
        AND (m.client_id = auth.uid() OR m.selected_hacker_id = auth.uid())
    )
  );

-- Enable Realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_messages;

-- ── 4. indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS missions_client_id_idx    ON public.missions(client_id);
CREATE INDEX IF NOT EXISTS missions_status_idx        ON public.missions(status);
CREATE INDEX IF NOT EXISTS proposals_mission_idx      ON public.mission_proposals(mission_id);
CREATE INDEX IF NOT EXISTS messages_mission_time_idx  ON public.mission_messages(mission_id, created_at);
