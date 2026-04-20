-- Emergency Policy Fix for ForgeGuard AI
-- Run this in Supabase SQL Editor if the previous fix didn't work

-- Temporarily disable RLS on profiles to break the recursion
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL admin policies that might cause issues
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can manage services" ON public.services;
DROP POLICY IF EXISTS "Admin can manage skills" ON public.skills;
DROP POLICY IF EXISTS "Admin can manage showcase projects" ON public.showcase_projects;
DROP POLICY IF EXISTS "Admin can view contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admin can update contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admin can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admin can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Admin can manage all files" ON public.project_files;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create simple admin policies that don't cause recursion
CREATE POLICY "Admin full access" ON public.profiles
    FOR ALL USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin full access" ON public.projects
    FOR ALL USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin full access" ON public.project_files
    FOR ALL USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin full access" ON public.messages
    FOR ALL USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin full access" ON public.bookings
    FOR ALL USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin full access" ON public.services
    FOR ALL USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin full access" ON public.skills
    FOR ALL USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin full access" ON public.showcase_projects
    FOR ALL USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin full access" ON public.contact_submissions
    FOR ALL USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin full access" ON public.activity_logs
    FOR ALL USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

SELECT 'Emergency policy fix completed!' as status;