-- Fix RLS Policies for ForgeGuard AI
-- Run this in Supabase SQL Editor

-- Disable email confirmation for development (so you can login immediately)
ALTER TABLE auth.users
ALTER COLUMN email_confirmed_at
SET DEFAULT now();

-- Also confirm your own user if it exists
UPDATE auth.users
SET email_confirmed_at = now(), confirmed_at = now()
WHERE email = 'kkdev9715@gmail.com';

-- Safe Admin Policy Fix (using email check)
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can manage services" ON public.services;
DROP POLICY IF EXISTS "Admin can manage skills" ON public.skills;
DROP POLICY IF EXISTS "Admin can manage showcase projects" ON public.showcase_projects;
DROP POLICY IF EXISTS "Admin can manage contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admin can manage activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admin can manage projects" ON public.projects;
DROP POLICY IF EXISTS "Admin can manage project files" ON public.project_files;

-- Create safe admin policies
CREATE POLICY "Admin can manage all profiles"
    ON public.profiles FOR ALL
    USING (email = 'kkdev9715@gmail.com');

CREATE POLICY "Admin can manage all bookings"
    ON public.bookings FOR ALL
    USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin can manage services"
    ON public.services FOR ALL
    USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin can manage skills"
    ON public.skills FOR ALL
    USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin can manage showcase projects"
    ON public.showcase_projects FOR ALL
    USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin can manage contact submissions"
    ON public.contact_submissions FOR ALL
    USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin can manage activity logs"
    ON public.activity_logs FOR ALL
    USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin can manage projects"
    ON public.projects FOR ALL
    USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

CREATE POLICY "Admin can manage project files"
    ON public.project_files FOR ALL
    USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');

SELECT '✅ Policies fixed successfully!' as status;
CREATE POLICY "Admin can manage all files" 
    ON public.project_files FOR ALL 
    USING (auth.jwt() ->> 'email' = 'kkdev9715@gmail.com');
SELECT 'RLS policies fixed successfully!' as status;