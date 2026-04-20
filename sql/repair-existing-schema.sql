-- =====================================================
-- FORGEGUARD AI - SAFE SCHEMA REPAIR
-- =====================================================
-- Run this in Supabase SQL Editor before rerunning any migration script.
-- It updates existing tables by adding missing columns and fixes known
-- schema drift issues without dropping tables or losing data.

-- 1. Ensure profiles.role exists
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'client'));
  END IF;
END $$;

-- 2. Repair services schema
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS features TEXT[];

-- 3. Repair messages schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'recipient_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'receiver_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.messages RENAME COLUMN recipient_id TO receiver_id';
  END IF;
END $$;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Add missing columns for project_submissions if needed
ALTER TABLE public.project_submissions
  ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE public.project_submissions
  ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE public.project_submissions
  ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.project_submissions
  ADD COLUMN IF NOT EXISTS budget_range TEXT;
ALTER TABLE public.project_submissions
  ADD COLUMN IF NOT EXISTS timeline TEXT;
ALTER TABLE public.project_submissions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.project_submissions
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 5. Add missing columns for projects if needed
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES public.project_submissions(id) ON DELETE SET NULL;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type TEXT;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS budget_range TEXT;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS demo_url TEXT;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS loom_url TEXT;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 6. Add missing columns for bookings if needed
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS duration_hours INTEGER;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 7. Add missing columns for showcase_projects if needed
ALTER TABLE public.showcase_projects
  ADD COLUMN IF NOT EXISTS technologies TEXT[];
ALTER TABLE public.showcase_projects
  ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE public.showcase_projects
  ADD COLUMN IF NOT EXISTS demo_url TEXT;
ALTER TABLE public.showcase_projects
  ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.showcase_projects
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;

-- 8. Fix project_files if needed
ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id);

-- 9. Create indexes only if columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'receiver_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id)';
  END IF;
END $$;

-- 10. Repair RLS policy naming and admin WITH CHECK
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their sent messages" ON public.messages;

CREATE POLICY "Users can view their messages"
    ON public.messages FOR SELECT
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages"
    ON public.messages FOR INSERT
    WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update their sent messages"
    ON public.messages FOR UPDATE
    USING (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid());

-- Ensure admin policies use WITH CHECK for all operations
DROP POLICY IF EXISTS "Admin can manage services" ON public.services;
CREATE POLICY "Admin can manage services"
    ON public.services FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can manage bookings" ON public.bookings;
CREATE POLICY "Admin can manage bookings"
    ON public.bookings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can manage all projects" ON public.projects;
CREATE POLICY "Admin can manage all projects"
    ON public.projects FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can manage showcase projects" ON public.showcase_projects;
CREATE POLICY "Admin can manage showcase projects"
    ON public.showcase_projects FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can manage contact submissions" ON public.contact_submissions;
CREATE POLICY "Admin can manage contact submissions"
    ON public.contact_submissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can view all activity logs" ON public.activity_logs;
CREATE POLICY "Admin can view all activity logs"
    ON public.activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'user_id'
  ) THEN
    DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
    CREATE POLICY "Users can view their own activity logs"
        ON public.activity_logs FOR SELECT
        USING (user_id = auth.uid());
  END IF;
END $$;

SELECT '✅ Repair script executed' as status;
