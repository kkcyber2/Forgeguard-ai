-- 20260629_operator_tool_executions.sql
-- Telemetry for operator-authored custom_attack_tools (separate from custom_tools FK).
-- Idempotent; safe to re-run.

CREATE TABLE IF NOT EXISTS public.operator_tool_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.custom_attack_tools(id) ON DELETE CASCADE,
  scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  exit_code int,
  stdout_preview text,
  stderr_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_tool_executions_tool_idx
  ON public.operator_tool_executions (tool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS operator_tool_executions_author_idx
  ON public.operator_tool_executions (author_id, created_at DESC);

ALTER TABLE public.operator_tool_executions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "operator_exec author read"
    ON public.operator_tool_executions FOR SELECT
    USING (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "operator_exec admin read"
    ON public.operator_tool_executions FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.access_level >= 5
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;
