-- =====================================================
-- FORGEGUARD AI - COMPLETE DATABASE SETUP
-- =====================================================
-- Run this in Supabase SQL Editor to set up ALL missing tables
-- This fixes the project submissions issue and adds all features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROJECT SUBMISSIONS TABLE (Fixes the broken submit form)
-- =====================================================
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

-- Enable RLS on project_submissions
ALTER TABLE public.project_submissions ENABLE ROW LEVEL SECURITY;

-- Project Submissions RLS Policies
DROP POLICY IF EXISTS "Clients can view own submissions" ON public.project_submissions;
DROP POLICY IF EXISTS "Clients can create submissions" ON public.project_submissions;
DROP POLICY IF EXISTS "Clients can update own submissions" ON public.project_submissions;
DROP POLICY IF EXISTS "Admin can manage submissions" ON public.project_submissions;

CREATE POLICY "Clients can view own submissions"
    ON public.project_submissions FOR SELECT
    USING (client_id = auth.uid());

CREATE POLICY "Clients can create submissions"
    ON public.project_submissions FOR INSERT
    WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update own submissions"
    ON public.project_submissions FOR UPDATE
    USING (client_id = auth.uid());

CREATE POLICY "Admin can manage submissions"
    ON public.project_submissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- 2. PROJECTS TABLE (For project management)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES public.project_submissions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'completed', 'cancelled')),
    project_type TEXT NOT NULL CHECK (project_type IN (
        'ai_red_teaming',
        'llm_security_audit',
        'secure_agent_development',
        'ml_model_hardening',
        'prompt_engineering',
        'consultation',
        'other'
    )),
    budget_range TEXT,
    deadline DATE,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    github_url TEXT,
    demo_url TEXT,
    loom_url TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects RLS Policies
DROP POLICY IF EXISTS "Clients can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Admin can manage all projects" ON public.projects;

CREATE POLICY "Clients can view own projects"
    ON public.projects FOR SELECT
    USING (client_id = auth.uid());

CREATE POLICY "Admin can manage all projects"
    ON public.projects FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- 3. MESSAGES TABLE (For client-admin communication)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages RLS Policies
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
    USING (sender_id = auth.uid());

-- =====================================================
-- 4. BOOKINGS TABLE (For service bookings)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    scheduled_date DATE,
    duration_hours INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Bookings RLS Policies
DROP POLICY IF EXISTS "Clients can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can manage all bookings" ON public.bookings;

CREATE POLICY "Clients can view own bookings"
    ON public.bookings FOR SELECT
    USING (client_id = auth.uid());

CREATE POLICY "Clients can create bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (client_id = auth.uid());

CREATE POLICY "Admin can manage all bookings"
    ON public.bookings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- 5. SERVICES TABLE (Available services)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price_range TEXT,
    duration_hours INTEGER,
    features TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Services RLS Policies (public read, admin write)
DROP POLICY IF EXISTS "Everyone can view services" ON public.services;
DROP POLICY IF EXISTS "Admin can manage services" ON public.services;

CREATE POLICY "Everyone can view services"
    ON public.services FOR SELECT
    USING (true);

CREATE POLICY "Admin can manage services"
    ON public.services FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- 6. SKILLS TABLE (Technical skills)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    proficiency INTEGER CHECK (proficiency >= 0 AND proficiency <= 100),
    years_experience INTEGER,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

-- Skills RLS Policies (public read, admin write)
DROP POLICY IF EXISTS "Everyone can view skills" ON public.skills;
DROP POLICY IF EXISTS "Admin can manage skills" ON public.skills;

CREATE POLICY "Everyone can view skills"
    ON public.skills FOR SELECT
    USING (true);

CREATE POLICY "Admin can manage skills"
    ON public.skills FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- 7. SHOWCASE PROJECTS TABLE (Portfolio)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.showcase_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    technologies TEXT[],
    github_url TEXT,
    demo_url TEXT,
    image_url TEXT,
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on showcase_projects
ALTER TABLE public.showcase_projects ENABLE ROW LEVEL SECURITY;

-- Showcase Projects RLS Policies (public read, admin write)
DROP POLICY IF EXISTS "Everyone can view showcase projects" ON public.showcase_projects;
DROP POLICY IF EXISTS "Admin can manage showcase projects" ON public.showcase_projects;

CREATE POLICY "Everyone can view showcase projects"
    ON public.showcase_projects FOR SELECT
    USING (true);

CREATE POLICY "Admin can manage showcase projects"
    ON public.showcase_projects FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- 8. CONTACT SUBMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    message TEXT NOT NULL,
    service_interest TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'archived')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on contact_submissions
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Contact Submissions RLS Policies
DROP POLICY IF EXISTS "Everyone can create contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admin can manage contact submissions" ON public.contact_submissions;

CREATE POLICY "Everyone can create contact submissions"
    ON public.contact_submissions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admin can manage contact submissions"
    ON public.contact_submissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- 9. ACTIVITY LOGS TABLE (Audit trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Activity Logs RLS Policies
DROP POLICY IF EXISTS "Admin can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;

CREATE POLICY "Admin can view all activity logs"
    ON public.activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can view their own activity logs"
    ON public.activity_logs FOR SELECT
    USING (user_id = auth.uid());

-- =====================================================
-- 10. PROJECT FILES TABLE (File attachments)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on project_files
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- Project Files RLS Policies
DROP POLICY IF EXISTS "Project participants can view files" ON public.project_files;
DROP POLICY IF EXISTS "Project participants can upload files" ON public.project_files;

CREATE POLICY "Project participants can view files"
    ON public.project_files FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_files.project_id
            AND (p.client_id = auth.uid() OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role = 'admin'
            ))
        )
    );

CREATE POLICY "Project participants can upload files"
    ON public.project_files FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_files.project_id
            AND (p.client_id = auth.uid() OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role = 'admin'
            ))
        )
    );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_project_submissions_client_id
    ON public.project_submissions(client_id);

CREATE INDEX IF NOT EXISTS idx_project_submissions_status
    ON public.project_submissions(status);

CREATE INDEX IF NOT EXISTS idx_project_submissions_created_at
    ON public.project_submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_client_id
    ON public.projects(client_id);

CREATE INDEX IF NOT EXISTS idx_projects_status
    ON public.projects(status);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
    ON public.messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_id
    ON public.messages(receiver_id);

CREATE INDEX IF NOT EXISTS idx_messages_project_id
    ON public.messages(project_id);

-- =====================================================
-- SEED DATA (Optional - for development)
-- =====================================================

-- Insert sample services
INSERT INTO public.services (name, description, category, price_range, duration_hours, features)
VALUES
    ('AI Red Teaming', 'Comprehensive security testing of AI systems against adversarial attacks', 'Security', '$5,000 - $25,000', 40, ARRAY['Prompt injection testing', 'Model poisoning detection', 'Adversarial input analysis', 'Security report']),
    ('Secure AI Agents', 'Development of secure AI agent architectures and implementations', 'Development', '$10,000 - $50,000', 80, ARRAY['Secure agent framework', 'Input validation', 'Output sanitization', 'Audit logging']),
    ('ML Model Hardening', 'Strengthen ML models against adversarial attacks and data poisoning', 'Security', '$8,000 - $30,000', 60, ARRAY['Adversarial training', 'Input preprocessing', 'Model validation', 'Performance monitoring']),
    ('Prompt Engineering', 'Secure prompt design and injection prevention strategies', 'Security', '$3,000 - $15,000', 20, ARRAY['Prompt analysis', 'Injection prevention', 'Template design', 'Testing framework']),
    ('AI Security Consultation', 'Expert guidance on AI security best practices and implementation', 'Consultation', '$2,000 - $10,000', 16, ARRAY['Security assessment', 'Best practices review', 'Implementation guidance', 'Training session'])
ON CONFLICT DO NOTHING;

-- Insert sample skills
INSERT INTO public.skills (name, category, proficiency, years_experience, is_featured)
VALUES
    ('AI Red Teaming', 'AI Security', 95, 3, true),
    ('Prompt Injection Defense', 'AI Security', 90, 2, true),
    ('Machine Learning Security', 'AI Security', 88, 3, true),
    ('Adversarial ML', 'AI Security', 85, 2, true),
    ('Secure AI Architecture', 'AI Development', 92, 3, true),
    ('Python Security', 'Development', 90, 4, true),
    ('LLM Fine-tuning', 'AI/ML', 87, 2, true),
    ('Ethical AI', 'AI Ethics', 93, 3, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT
    '✅ FORGEGUARD AI DATABASE SETUP COMPLETE!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
    NOW() as setup_completed_at;