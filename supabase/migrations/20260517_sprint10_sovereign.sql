-- =============================================================================
-- Sprint 10 — Sovereign Dominance schema
-- =============================================================================
-- Tables:
--   agent_memories        : AI step-by-step "Thoughts" stored per scan
--   target_verifications  : domain/IP ownership proofs (DNS TXT or file)
--   bounty_escrow         : payment hold/release state per submission
-- =============================================================================

-- ─── agent_memories ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_memories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id     uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Which model/role generated this thought
  agent_role  text NOT NULL CHECK (agent_role IN ('general','soldier_payload','soldier_recon','reporter')),
  model_id    text NOT NULL,          -- e.g. "deepseek/deepseek-r1", "dolphin-2.9", "llama-3.3-70b"

  -- The thought itself
  thought     text NOT NULL,          -- plain-English reasoning step
  tool_call   jsonb,                  -- tool name + args if any
  tool_result jsonb,                  -- tool output if any

  step_index  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_memories: owner can read"
  ON public.agent_memories FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "agent_memories: service role inserts"
  ON public.agent_memories FOR INSERT
  WITH CHECK (true);   -- service role bypasses RLS; anon/user cannot insert

CREATE INDEX idx_agent_memories_scan  ON public.agent_memories (scan_id, step_index);
CREATE INDEX idx_agent_memories_user  ON public.agent_memories (user_id, created_at DESC);

-- Realtime — let the report page subscribe to live thought streaming
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_memories;


-- ─── target_verifications ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.target_verifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_domain   text NOT NULL,       -- e.g. "example.com"
  method          text NOT NULL CHECK (method IN ('dns_txt','file_upload','email_confirm')),
  token           text NOT NULL,       -- the verification token we issued
  verified        boolean NOT NULL DEFAULT false,
  verified_at     timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, target_domain)
);

ALTER TABLE public.target_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verifications: owner CRUD"
  ON public.target_verifications
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_target_verif_user   ON public.target_verifications (user_id);
CREATE INDEX idx_target_verif_domain ON public.target_verifications (target_domain);


-- ─── bounty_escrow ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bounty_escrow (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL,       -- FK to bounty submissions (soft ref, no cascade)
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount_usd      numeric(10,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'USD',

  -- Lifecycle: held → released | refunded
  status          text NOT NULL DEFAULT 'held'
                  CHECK (status IN ('held','released','refunded','pending')),

  held_at         timestamptz NOT NULL DEFAULT now(),
  released_at     timestamptz,
  release_note    text,               -- admin note on payout

  -- Payment processor refs (LS / Stripe)
  processor       text,               -- 'lemonsqueezy' | 'stripe' | 'manual'
  processor_ref   text,               -- order_id / payment_intent_id
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bounty_escrow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escrow: owner can read"
  ON public.bounty_escrow FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "escrow: service role full access"
  ON public.bounty_escrow FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_bounty_escrow_user       ON public.bounty_escrow (user_id);
CREATE INDEX idx_bounty_escrow_submission ON public.bounty_escrow (submission_id);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_bounty_escrow_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_bounty_escrow_updated
  BEFORE UPDATE ON public.bounty_escrow
  FOR EACH ROW EXECUTE FUNCTION public.set_bounty_escrow_updated_at();
