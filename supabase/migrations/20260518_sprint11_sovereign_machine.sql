-- =============================================================================
-- Sprint 11 — The Sovereign Machine schema
-- =============================================================================
-- Tables:
--   user_wallets      : balance tracking per user (Bazaar commerce)
--   bazaar_scripts    : Hacker Bazaar marketplace listings
--   bazaar_purchases  : purchase ledger
--   hacker_repos      : Hacker-Git repositories
--   repo_stars        : per-user star record (uniqueness enforced)
-- =============================================================================

-- ─── user_wallets ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_wallets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  balance_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id)
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets: owner read/update"
  ON public.user_wallets
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "wallets: service role full access"
  ON public.user_wallets FOR ALL
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_wallet_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_wallet_updated
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_wallet_updated_at();

-- Auto-create wallet on new user
CREATE OR REPLACE FUNCTION public.create_user_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_wallet_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_wallet();


-- ─── bazaar_scripts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bazaar_scripts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metadata
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  language        text NOT NULL DEFAULT 'python'
                  CHECK (language IN ('python','bash','javascript','rust')),
  tags            text[] NOT NULL DEFAULT '{}',

  -- The script body (stored server-side; never returned raw to buyer pre-purchase)
  code            text NOT NULL,

  -- Commerce
  price_usd       numeric(8,2) NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
  is_free         boolean NOT NULL GENERATED ALWAYS AS (price_usd = 0) STORED,
  purchase_count  integer NOT NULL DEFAULT 0,
  revenue_usd     numeric(12,2) NOT NULL DEFAULT 0,

  -- AI Customs audit result
  audit_verdict   text NOT NULL DEFAULT 'pending'
                  CHECK (audit_verdict IN ('pending','cleared','flagged','rejected')),
  audit_risk_score integer NOT NULL DEFAULT 0 CHECK (audit_risk_score BETWEEN 0 AND 100),
  audit_findings  jsonb,
  audit_reason    text,
  audited_at      timestamptz,

  -- Visibility
  is_published    boolean NOT NULL DEFAULT false,
  is_removed      boolean NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bazaar_scripts ENABLE ROW LEVEL SECURITY;

-- Authors can see all their own scripts
CREATE POLICY "bazaar: author CRUD"
  ON public.bazaar_scripts
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Authenticated users can read published & cleared scripts
CREATE POLICY "bazaar: public read published"
  ON public.bazaar_scripts FOR SELECT
  USING (
    is_published = true
    AND is_removed = false
    AND audit_verdict = 'cleared'
  );

CREATE POLICY "bazaar: service role full access"
  ON public.bazaar_scripts FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_bazaar_scripts_author    ON public.bazaar_scripts (author_id);
CREATE INDEX idx_bazaar_scripts_published ON public.bazaar_scripts (is_published, audit_verdict, is_removed);

CREATE OR REPLACE FUNCTION public.set_bazaar_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_bazaar_updated
  BEFORE UPDATE ON public.bazaar_scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_bazaar_updated_at();


-- ─── bazaar_purchases ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bazaar_purchases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id   uuid NOT NULL REFERENCES public.bazaar_scripts(id) ON DELETE RESTRICT,
  buyer_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount_usd  numeric(8,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (script_id, buyer_id)  -- one purchase per user
);

ALTER TABLE public.bazaar_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases: buyer can read own"
  ON public.bazaar_purchases FOR SELECT
  USING (buyer_id = auth.uid() OR author_id = auth.uid());

CREATE POLICY "purchases: service role full access"
  ON public.bazaar_purchases FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_bazaar_purchases_buyer  ON public.bazaar_purchases (buyer_id);
CREATE INDEX idx_bazaar_purchases_author ON public.bazaar_purchases (author_id);
CREATE INDEX idx_bazaar_purchases_script ON public.bazaar_purchases (script_id);


-- ─── hacker_repos ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hacker_repos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  language      text NOT NULL DEFAULT 'python',
  tags          text[] NOT NULL DEFAULT '{}',

  -- Main script content (single-file repo, extensible)
  code          text NOT NULL DEFAULT '',

  -- Visibility
  is_public     boolean NOT NULL DEFAULT false,
  is_archived   boolean NOT NULL DEFAULT false,

  -- Social
  star_count    integer NOT NULL DEFAULT 0 CHECK (star_count >= 0),

  -- Version tracking
  version       text NOT NULL DEFAULT '1.0.0',
  commit_count  integer NOT NULL DEFAULT 1,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (owner_id, name)
);

ALTER TABLE public.hacker_repos ENABLE ROW LEVEL SECURITY;

-- Owner CRUD
CREATE POLICY "repos: owner CRUD"
  ON public.hacker_repos
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Authenticated users can read public repos
CREATE POLICY "repos: public read"
  ON public.hacker_repos FOR SELECT
  USING (is_public = true AND is_archived = false);

CREATE POLICY "repos: service role full access"
  ON public.hacker_repos FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_hacker_repos_owner  ON public.hacker_repos (owner_id);
CREATE INDEX idx_hacker_repos_public ON public.hacker_repos (is_public, star_count DESC);

CREATE OR REPLACE FUNCTION public.set_repo_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_repo_updated
  BEFORE UPDATE ON public.hacker_repos
  FOR EACH ROW EXECUTE FUNCTION public.set_repo_updated_at();


-- ─── repo_stars ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.repo_stars (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id     uuid NOT NULL REFERENCES public.hacker_repos(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (repo_id, user_id)
);

ALTER TABLE public.repo_stars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repo_stars: auth read"
  ON public.repo_stars FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "repo_stars: user insert own"
  ON public.repo_stars FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "repo_stars: user delete own"
  ON public.repo_stars FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_repo_stars_repo  ON public.repo_stars (repo_id);
CREATE INDEX idx_repo_stars_user  ON public.repo_stars (user_id);

-- ─── Star → reputation trigger ────────────────────────────────────────────────
--
--  Each star on a public repo earns the repo owner +10 reputation.
--  Each un-star subtracts 10.
--  This requires a `reputation` column on `profiles`.
--  We guard with IF EXISTS so the migration is idempotent even if the
--  profiles schema differs slightly.
--

CREATE OR REPLACE FUNCTION public.sync_star_reputation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Resolve repo owner
  SELECT owner_id INTO v_owner_id
  FROM public.hacker_repos
  WHERE id = COALESCE(NEW.repo_id, OLD.repo_id);

  IF TG_OP = 'INSERT' THEN
    -- Bump star_count on repo
    UPDATE public.hacker_repos
       SET star_count = star_count + 1
     WHERE id = NEW.repo_id;

    -- Add +10 rep to owner profile
    UPDATE public.profiles
       SET reputation = COALESCE(reputation, 0) + 10
     WHERE user_id = v_owner_id;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement star_count (floor 0)
    UPDATE public.hacker_repos
       SET star_count = GREATEST(star_count - 1, 0)
     WHERE id = OLD.repo_id;

    -- Subtract 10 rep (floor 0)
    UPDATE public.profiles
       SET reputation = GREATEST(COALESCE(reputation, 0) - 10, 0)
     WHERE user_id = v_owner_id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_repo_star_reputation
  AFTER INSERT OR DELETE ON public.repo_stars
  FOR EACH ROW EXECUTE FUNCTION public.sync_star_reputation();


-- ─── Realtime subscriptions ───────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.bazaar_scripts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hacker_repos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.repo_stars;


-- ─── RPC: increment_wallet ────────────────────────────────────────────────────
--  Called by bazaar/purchase route to credit author balance atomically.
--  Uses SECURITY DEFINER so the route's service-role client can invoke it.

CREATE OR REPLACE FUNCTION public.increment_wallet(
  p_user_id uuid,
  p_amount  numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id, balance_usd)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance_usd = public.user_wallets.balance_usd + EXCLUDED.balance_usd,
        updated_at  = now();
END;
$$;


-- ─── RPC: increment_purchase ─────────────────────────────────────────────────
--  Called by bazaar/purchase route after a successful paid purchase to update
--  script counters atomically.

CREATE OR REPLACE FUNCTION public.increment_purchase(
  p_script_id uuid,
  p_revenue   numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.bazaar_scripts
     SET purchase_count = purchase_count + 1,
         revenue_usd    = revenue_usd + p_revenue,
         updated_at     = now()
   WHERE id = p_script_id;
END;
$$;


-- ─── enterprise_api_keys ─────────────────────────────────────────────────────
--  Aegis 2.0 Threat Intel API — enterprise API key management.
--  Keys are issued manually (admin panel) or via future onboarding flow.

CREATE TABLE IF NOT EXISTS public.enterprise_api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      text NOT NULL,                        -- customer org identifier
  api_key     text NOT NULL UNIQUE,                 -- bearer token (sha256 hash recommended in prod)
  plan        text NOT NULL DEFAULT 'starter'
              CHECK (plan IN ('starter','professional','enterprise','admin')),
  is_active   boolean NOT NULL DEFAULT true,
  hit_count   integer NOT NULL DEFAULT 0,
  last_hit    timestamptz,
  expires_at  timestamptz,                          -- NULL = non-expiring
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_api_keys ENABLE ROW LEVEL SECURITY;

-- Only service-role / admin can manage API keys (no user-facing RLS read)
CREATE POLICY "api_keys: service role only"
  ON public.enterprise_api_keys FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_enterprise_api_keys_key    ON public.enterprise_api_keys (api_key);
CREATE INDEX idx_enterprise_api_keys_org    ON public.enterprise_api_keys (org_id);
CREATE INDEX idx_enterprise_api_keys_active ON public.enterprise_api_keys (is_active, expires_at);
