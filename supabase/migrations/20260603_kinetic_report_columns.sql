-- Kinetic strike four-section report columns for scan_reports
ALTER TABLE public.scan_reports
  ADD COLUMN IF NOT EXISTS executive_summary text,
  ADD COLUMN IF NOT EXISTS technical_proof_of_concept text,
  ADD COLUMN IF NOT EXISTS remediation_code_snippet text;

COMMENT ON COLUMN public.scan_reports.executive_summary IS
  'Plain-text executive summary from DeepSeek-R1 kinetic judge';

COMMENT ON COLUMN public.scan_reports.technical_proof_of_concept IS
  'Numbered reproduction steps for the top breach finding';

COMMENT ON COLUMN public.scan_reports.remediation_code_snippet IS
  'Aegis regex or middleware snippet to block the attack vector';
