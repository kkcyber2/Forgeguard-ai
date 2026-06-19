-- Phase 3: Social feed + teams (Intel Hub)

CREATE TABLE IF NOT EXISTS public.teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  owner_id   UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id   UUID NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.team_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  team_id     UUID REFERENCES public.teams (id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) <= 2000),
  media_path  TEXT,
  visibility  TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'team')),
  like_count  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_post_likes (
  post_id    UUID NOT NULL REFERENCES public.social_posts (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS social_posts_created_idx ON public.social_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_team_idx ON public.social_posts (team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS team_members_user_idx ON public.team_members (user_id);

-- Like count sync
CREATE OR REPLACE FUNCTION public.social_post_like_count_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS social_post_likes_count_trigger ON public.social_post_likes;
CREATE TRIGGER social_post_likes_count_trigger
  AFTER INSERT OR DELETE ON public.social_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.social_post_like_count_sync();

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;

-- Teams: members can read
DROP POLICY IF EXISTS teams_member_read ON public.teams;
CREATE POLICY teams_member_read ON public.teams FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS teams_owner_insert ON public.teams;
CREATE POLICY teams_owner_insert ON public.teams FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS teams_owner_update ON public.teams;
CREATE POLICY teams_owner_update ON public.teams FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- Team members
DROP POLICY IF EXISTS team_members_read ON public.team_members;
CREATE POLICY team_members_read ON public.team_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (SELECT team_id FROM public.team_members tm WHERE tm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS team_members_owner_manage ON public.team_members;
CREATE POLICY team_members_owner_manage ON public.team_members FOR ALL TO authenticated
  USING (
    team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

-- Social posts: public read; team posts for members
DROP POLICY IF EXISTS social_posts_read ON public.social_posts;
CREATE POLICY social_posts_read ON public.social_posts FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR (visibility = 'team' AND team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    ))
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS social_posts_insert ON public.social_posts;
CREATE POLICY social_posts_insert ON public.social_posts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      team_id IS NULL
      OR team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS social_post_likes_rw ON public.social_post_likes;
CREATE POLICY social_post_likes_rw ON public.social_post_likes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Invites: team admins/owners
DROP POLICY IF EXISTS team_invites_read ON public.team_invites;
CREATE POLICY team_invites_read ON public.team_invites FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS team_invites_insert ON public.team_invites;
CREATE POLICY team_invites_insert ON public.team_invites FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('social-media', 'social-media', false, 5242880)
ON CONFLICT (id) DO NOTHING;
