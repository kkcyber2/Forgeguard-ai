-- =====================================================
-- VERIFY AND SETUP PROJECT SUBMISSIONS TABLE
-- =====================================================
-- Run this in Supabase SQL Editor to ensure project_submissions table exists
-- with proper RLS policies

-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.project_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    github_url TEXT,
    service_type TEXT NOT NULL CHECK (service_type IN (
        'ai_red_teaming',
        'secure_ai_agents',
        'ml_hardening',
        'prompt_engineering',
        'consultation'
    )),
    description TEXT NOT NULL,
    budget_range TEXT,
    timeline TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.project_submissions ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to recreate them
DROP POLICY IF EXISTS "Clients can view own submissions" ON public.project_submissions;
DROP POLICY IF EXISTS "Clients can create submissions" ON public.project_submissions;
DROP POLICY IF EXISTS "Admin can view all submissions" ON public.project_submissions;
DROP POLICY IF EXISTS "Admin can manage submissions" ON public.project_submissions;

-- 4. Create new RLS policies
-- Allow clients to view their own submissions
CREATE POLICY "Clients can view own submissions" 
    ON public.project_submissions FOR SELECT 
    USING (client_id = auth.uid());

-- Allow clients to create submissions
CREATE POLICY "Clients can create submissions" 
    ON public.project_submissions FOR INSERT 
    WITH CHECK (client_id = auth.uid());

-- Allow clients to update their own submissions
CREATE POLICY "Clients can update own submissions"
    ON public.project_submissions FOR UPDATE
    USING (client_id = auth.uid());

-- Allow admins to manage all submissions
CREATE POLICY "Admin can manage submissions" 
    ON public.project_submissions FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 5. Create an index on client_id for better query performance
CREATE INDEX IF NOT EXISTS idx_project_submissions_client_id 
    ON public.project_submissions(client_id);

CREATE INDEX IF NOT EXISTS idx_project_submissions_status 
    ON public.project_submissions(status);

CREATE INDEX IF NOT EXISTS idx_project_submissions_created_at 
    ON public.project_submissions(created_at DESC);

SELECT 
    '✅ PROJECT SUBMISSIONS TABLE SETUP COMPLETE' as status,
    table_name,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'project_submissions') as table_exists
FROM information_schema.tables 
WHERE table_name = 'project_submissions';

-- Test query to verify setup
-- SELECT * FROM public.project_submissions LIMIT 1;
