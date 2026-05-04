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

ALTER TABLE public.project_submissions ENABLE ROW LEVEL SECURITY;

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