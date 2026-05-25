-- Persona Switcher — persist CLIENT / HACKER / DEV mode across sessions

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_persona text;

UPDATE public.profiles
   SET current_persona = CASE
     WHEN active_view_mode IN ('client', 'hacker') THEN active_view_mode
     WHEN user_type = 'client' THEN 'client'
     WHEN user_type = 'hacker' THEN 'hacker'
     WHEN user_type = 'developer' THEN COALESCE(active_view_mode, 'hacker')
     ELSE 'hacker'
   END
 WHERE current_persona IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN current_persona SET DEFAULT 'hacker';

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_current_persona_check
    CHECK (current_persona IS NULL OR current_persona IN ('client', 'hacker', 'dev'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.profiles.current_persona IS
  'Active UI persona: client | hacker | dev (Sovereign admin console)';
