-- =====================================================
-- ForgeGuard AI - Supabase Database Schema
-- =====================================================
-- This schema creates all necessary tables for the ForgeGuard AI platform
-- including clients, projects, messages, bookings, and project files.
-- All tables have Row Level Security (RLS) enabled with appropriate policies.
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES TABLE (extends Supabase Auth users)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    company_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'client' CHECK (role IN ('admin', 'client')),
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies (idempotent)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles" 
    ON public.profiles FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id, 
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'role', 'client')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- PROJECTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

-- Projects RLS Policies (idempotent)
DROP POLICY IF EXISTS "Clients can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Clients can create projects" ON public.projects;
DROP POLICY IF EXISTS "Clients can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Admin can view all projects" ON public.projects;

CREATE POLICY "Clients can view own projects" 
    ON public.projects FOR SELECT 
    USING (client_id = auth.uid());

CREATE POLICY "Clients can create projects" 
    ON public.projects FOR INSERT 
    WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update own projects" 
    ON public.projects FOR UPDATE 
    USING (client_id = auth.uid());

CREATE POLICY "Admin can view all projects" 
    ON public.projects FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- PROJECT FILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES public.profiles(id),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on project_files
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- Project Files RLS Policies (idempotent)
DROP POLICY IF EXISTS "Clients can view files for own projects" ON public.project_files;
DROP POLICY IF EXISTS "Clients can upload files to own projects" ON public.project_files;
DROP POLICY IF EXISTS "Admin can manage all files" ON public.project_files;

CREATE POLICY "Clients can view files for own projects" 
    ON public.project_files FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = project_files.project_id 
            AND projects.client_id = auth.uid()
        )
    );

CREATE POLICY "Clients can upload files to own projects" 
    ON public.project_files FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = project_files.project_id 
            AND projects.client_id = auth.uid()
        )
    );

CREATE POLICY "Admin can manage all files" 
    ON public.project_files FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- MESSAGES TABLE (Client-Admin Chat)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    attachments JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages RLS Policies (idempotent)
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages (mark as read)" ON public.messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;

CREATE POLICY "Users can view messages they sent or received" 
    ON public.messages FOR SELECT 
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages" 
    ON public.messages FOR INSERT 
    WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update own messages (mark as read)" 
    ON public.messages FOR UPDATE 
    USING (receiver_id = auth.uid());

CREATE POLICY "Users can delete own messages" 
    ON public.messages FOR DELETE 
    USING (sender_id = auth.uid());

-- =====================================================
-- BOOKINGS TABLE (Project Requests)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_type TEXT NOT NULL CHECK (project_type IN (
        'ai_red_teaming',
        'llm_security_audit',
        'secure_agent_development',
        'ml_model_hardening',
        'prompt_engineering',
        'consultation',
        'other'
    )),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    budget_range TEXT,
    preferred_start_date DATE,
    urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    admin_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Bookings RLS Policies (idempotent)
DROP POLICY IF EXISTS "Clients can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can update own pending bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can manage all bookings" ON public.bookings;

CREATE POLICY "Clients can view own bookings" 
    ON public.bookings FOR SELECT 
    USING (client_id = auth.uid());

CREATE POLICY "Clients can create bookings" 
    ON public.bookings FOR INSERT 
    WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update own pending bookings" 
    ON public.bookings FOR UPDATE 
    USING (client_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admin can manage all bookings" 
    ON public.bookings FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- SERVICES TABLE (Available Services)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    features JSONB DEFAULT '[]',
    starting_price INTEGER,
    estimated_duration TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on services (public read, admin write)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Services are publicly viewable" ON public.services;
DROP POLICY IF EXISTS "Admin can manage services" ON public.services;

CREATE POLICY "Services are publicly viewable" 
    ON public.services FOR SELECT 
    TO PUBLIC 
    USING (is_active = true);

CREATE POLICY "Admin can manage services" 
    ON public.services FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- SKILLS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'ai_ml_tools',
        'red_teaming_tools',
        'programming',
        'deployment',
        'security',
        'other'
    )),
    proficiency INTEGER CHECK (proficiency >= 0 AND proficiency <= 100),
    icon TEXT,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on skills (public read, admin write)
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Skills are publicly viewable" ON public.skills;
DROP POLICY IF EXISTS "Admin can manage skills" ON public.skills;

CREATE POLICY "Skills are publicly viewable" 
    ON public.skills FOR SELECT 
    TO PUBLIC 
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
-- SHOWCASE PROJECTS TABLE (Portfolio)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.showcase_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    thumbnail_url TEXT,
    images JSONB DEFAULT '[]',
    technologies JSONB DEFAULT '[]',
    github_url TEXT,
    demo_url TEXT,
    loom_url TEXT,
    category TEXT,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on showcase_projects (public read, admin write)
ALTER TABLE public.showcase_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Showcase projects are publicly viewable" ON public.showcase_projects;
DROP POLICY IF EXISTS "Admin can manage showcase projects" ON public.showcase_projects;

CREATE POLICY "Showcase projects are publicly viewable" 
    ON public.showcase_projects FOR SELECT 
    TO PUBLIC 
    USING (is_active = true);

CREATE POLICY "Admin can manage showcase projects" 
    ON public.showcase_projects FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- CONTACT SUBMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on contact_submissions
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admin can view contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admin can update contact submissions" ON public.contact_submissions;

CREATE POLICY "Anyone can submit contact form" 
    ON public.contact_submissions FOR INSERT 
    TO PUBLIC 
    WITH CHECK (true);

CREATE POLICY "Admin can view contact submissions" 
    ON public.contact_submissions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admin can update contact submissions" 
    ON public.contact_submissions FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- PROJECT SUBMISSIONS TABLE (Client Requests)
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

-- Project Submissions RLS Policies (idempotent)
DROP POLICY IF EXISTS "Clients can view own submissions" ON public.project_submissions;
DROP POLICY IF EXISTS "Clients can create submissions" ON public.project_submissions;
DROP POLICY IF EXISTS "Admin can view all submissions" ON public.project_submissions;

CREATE POLICY "Clients can view own submissions" 
    ON public.project_submissions FOR SELECT 
    USING (client_id = auth.uid());

CREATE POLICY "Clients can create submissions" 
    ON public.project_submissions FOR INSERT 
    WITH CHECK (client_id = auth.uid());

CREATE POLICY "Admin can view all submissions" 
    ON public.project_submissions FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- ACTIVITY LOGS TABLE (Audit Trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admin can view all activity logs" ON public.activity_logs;

CREATE POLICY "Users can view own activity logs" 
    ON public.activity_logs FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Admin can view all activity logs" 
    ON public.activity_logs FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- REALTIME SUBSCRIPTIONS SETUP (Idempotent)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE schemaname = 'public'
      AND tablename  = 'messages'
      AND pubname    = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE schemaname = 'public'
      AND tablename  = 'projects'
      AND pubname    = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;
END $$;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp trigger to relevant tables (idempotent)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_showcase_projects_updated_at ON public.showcase_projects;
CREATE TRIGGER update_showcase_projects_updated_at 
    BEFORE UPDATE ON public.showcase_projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Log activity function
CREATE OR REPLACE FUNCTION log_activity(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert default services
INSERT INTO public.services (name, slug, description, short_description, features, starting_price, estimated_duration, icon, display_order) VALUES
(
    'AI Red Teaming & LLM Security Audits',
    'ai-red-teaming',
    'Comprehensive security testing of your AI systems. I simulate real-world attacks including prompt injection, jailbreaking, data extraction, and adversarial inputs to identify vulnerabilities before malicious actors do.',
    'Find vulnerabilities before attackers do',
    '["Prompt Injection Testing", "Jailbreak Attempts", "Data Extraction Tests", "Adversarial Input Analysis", "Safety Filter Bypass Testing", "Comprehensive Security Report"]',
    1500,
    '1-2 weeks',
    'Shield',
    1
),
(
    'Secure AI Agents & Automation',
    'secure-ai-agents',
    'Production-ready AI agents built with security-first architecture. From autonomous research agents to customer support bots, I build systems that are both powerful and resilient against attacks.',
    'Production-ready secure AI automation',
    '["Custom AI Agent Development", "Multi-Agent Systems", "Secure API Integration", "Input Validation & Sanitization", "Rate Limiting & Abuse Prevention", "Monitoring & Logging"]',
    2500,
    '2-4 weeks',
    'Bot',
    2
),
(
    'ML Model Hardening & Deployment',
    'ml-model-hardening',
    'Secure deployment of machine learning models with adversarial training, input validation, and production-grade monitoring. Protect your models from model inversion, membership inference, and other ML-specific attacks.',
    'Secure ML deployment at scale',
    '["Adversarial Training", "Model Encryption", "Secure API Deployment", "Input Preprocessing Pipeline", "Anomaly Detection", "A/B Testing Infrastructure"]',
    3000,
    '3-6 weeks',
    'Cpu',
    3
),
(
    'Prompt Engineering with Security',
    'secure-prompt-engineering',
    'Expert prompt engineering that balances capability with security. I design prompt systems that deliver excellent results while minimizing injection risks and maintaining output safety.',
    'Safe, effective prompt systems',
    '["System Prompt Design", "Few-Shot Prompt Optimization", "Chain-of-Thought Engineering", "Prompt Injection Mitigation", "Output Validation Rules", "Prompt Versioning & Testing"]',
    800,
    '3-5 days',
    'MessageSquare',
    4
),
(
    'Security Consultation',
    'security-consultation',
    'One-on-one consultation on AI security strategy, architecture review, and best practices. Perfect for teams building AI products who need expert guidance on security considerations.',
    'Expert AI security guidance',
    '["Architecture Security Review", "Threat Modeling", "Security Roadmap", "Team Training", "Code Review", "Ongoing Advisory"]',
    200,
    'Hourly',
    'Users',
    5
)
ON CONFLICT (slug) DO NOTHING;

-- Insert default skills
INSERT INTO public.skills (name, category, proficiency, icon, description, display_order) VALUES
-- AI/ML Tools
('OpenAI GPT-4/3.5', 'ai_ml_tools', 95, 'Brain', 'Expert-level prompt engineering and API integration', 1),
('LangChain', 'ai_ml_tools', 90, 'Link', 'Building complex AI agent workflows and chains', 2),
('LlamaIndex', 'ai_ml_tools', 85, 'Database', 'RAG systems and document indexing', 3),
('Hugging Face', 'ai_ml_tools', 88, 'Smile', 'Model deployment and transformer fine-tuning', 4),
('PyTorch', 'ai_ml_tools', 82, 'Flame', 'Deep learning model development', 5),
('TensorFlow', 'ai_ml_tools', 80, 'Layers', 'Production ML model deployment', 6),
('Anthropic Claude', 'ai_ml_tools', 92, 'MessageCircle', 'Claude API and constitutional AI', 7),
-- Red Teaming Tools
('Kali Linux', 'red_teaming_tools', 95, 'Terminal', 'Penetration testing and security auditing', 8),
('Burp Suite', 'red_teaming_tools', 88, 'Search', 'Web application security testing', 9),
('Metasploit', 'red_teaming_tools', 85, 'Target', 'Exploitation framework', 10),
('Wireshark', 'red_teaming_tools', 80, 'Activity', 'Network protocol analysis', 11),
('Nmap', 'red_teaming_tools', 90, 'Map', 'Network discovery and security auditing', 12),
('OWASP ZAP', 'red_teaming_tools', 85, 'ShieldAlert', 'Web app vulnerability scanner', 13),
-- Programming
('Python', 'programming', 95, 'Code2', 'Primary language for AI/ML development', 14),
('TypeScript/JavaScript', 'programming', 92, 'FileCode', 'Full-stack web development', 15),
('Go', 'programming', 78, 'Server', 'High-performance backend services', 16),
('Rust', 'programming', 75, 'Cog', 'Systems programming and security tools', 17),
('SQL', 'programming', 88, 'Table', 'Database design and optimization', 18),
-- Deployment
('Docker', 'deployment', 90, 'Container', 'Containerization and orchestration', 19),
('Kubernetes', 'deployment', 82, 'Boxes', 'Container orchestration at scale', 20),
('AWS/GCP/Azure', 'deployment', 85, 'Cloud', 'Cloud infrastructure and services', 21),
('CI/CD Pipelines', 'deployment', 88, 'GitBranch', 'Automated testing and deployment', 22),
('Vercel/Netlify', 'deployment', 92, 'Globe', 'Modern frontend deployment', 23)
ON CONFLICT DO NOTHING;

-- Insert sample showcase projects
INSERT INTO public.showcase_projects (title, slug, description, short_description, technologies, github_url, demo_url, category, is_featured, display_order) VALUES
(
    'PromptGuard - AI Injection Detector',
    'promptguard',
    'A real-time prompt injection detection system that analyzes user inputs to identify potential attacks before they reach the LLM. Uses ensemble methods combining rule-based detection with transformer-based classification.',
    'Real-time prompt injection detection',
    '["Python", "PyTorch", "FastAPI", "Redis", "Docker"]',
    'https://github.com/konainsultan/promptguard',
    'https://promptguard-demo.forgeguard.ai',
    'Security Tool',
    true,
    1
),
(
    'RedTeamLLM - Automated Adversarial Testing',
    'redteamllm',
    'An automated red teaming framework for LLMs that generates adversarial prompts, tests model responses, and produces comprehensive security reports. Includes pre-built attack templates and custom attack crafting.',
    'Automated LLM red teaming framework',
    '["Python", "LangChain", "OpenAI API", "Streamlit", "PostgreSQL"]',
    'https://github.com/konainsultan/redteamllm',
    'https://redteamllm-demo.forgeguard.ai',
    'Security Tool',
    true,
    2
),
(
    'SecureAgent - Hardened AI Assistant',
    'secureagent',
    'A production-ready AI assistant built with security-first architecture. Features input validation, output filtering, rate limiting, and comprehensive audit logging. Designed to handle sensitive user data safely.',
    'Production-ready secure AI assistant',
    '["TypeScript", "Next.js", "OpenAI", "Prisma", "Supabase"]',
    'https://github.com/konainsultan/secureagent',
    'https://secureagent-demo.forgeguard.ai',
    'AI Application',
    true,
    3
)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON public.messages(project_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON public.bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
SELECT 'ForgeGuard AI database schema created successfully!' as status;
