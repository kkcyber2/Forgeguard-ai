-- Section 14: ForgeGuard Certified bazaar seed (idempotent on fixed UUIDs)
DO $$
DECLARE
  v_author uuid;
BEGIN
  SELECT id INTO v_author FROM public.profiles ORDER BY created_at LIMIT 1;
  IF v_author IS NULL THEN
    RAISE NOTICE 'Section 14 skipped — no profiles row for author_id';
    RETURN;
  END IF;

  INSERT INTO public.bazaar_scripts (
    id, name, title, description, code, language, tags,
    author_id, is_certified, audit_verdict, is_published, is_removed,
    price_usd, audit_risk_score, safety_score, purchase_count
  ) VALUES
  (
    'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
    'llm-jailbreak-probe',
    'LLM Jailbreak Probe',
    'Multi-vector jailbreak harness for LLM guardrail evaluation and red-team probing.',
    '# ForgeGuard Certified — LLM Jailbreak Probe\nprint("jailbreak probe ready")',
    'python',
    ARRAY['llm', 'jailbreak', 'red-team'],
    v_author, true, 'cleared', true, false, 13, 22, 92, 156
  ),
  (
    'aaaaaaaa-0002-4000-8000-000000000002'::uuid,
    'rag-injection-scanner',
    'RAG Injection Scanner',
    'Detects document-poisoning and retrieval injection vectors in RAG pipelines.',
    '# ForgeGuard Certified — RAG Injection Scanner\nprint("rag scanner ready")',
    'python',
    ARRAY['rag', 'injection', 'llm'],
    v_author, true, 'cleared', true, false, 15, 35, 88, 98
  ),
  (
    'aaaaaaaa-0003-4000-8000-000000000003'::uuid,
    'prompt-exfil-kit',
    'Prompt Exfil Kit',
    'Structured prompt exfiltration toolkit for system-prompt and secret leakage tests.',
    '# ForgeGuard Certified — Prompt Exfil Kit\nprint("exfil kit ready")',
    'python',
    ARRAY['prompt', 'exfil', 'llm'],
    v_author, true, 'cleared', true, false, 10, 41, 85, 203
  ),
  (
    'aaaaaaaa-0004-4000-8000-000000000004'::uuid,
    'agent-tool-hijack',
    'Agent Tool Hijack',
    'Simulates tool-calling hijacks against autonomous agent frameworks.',
    '# ForgeGuard Certified — Agent Tool Hijack\nprint("tool hijack ready")',
    'javascript',
    ARRAY['agent', 'tool-calling', 'hijack'],
    v_author, true, 'cleared', true, false, 12, 48, 90, 74
  ),
  (
    'aaaaaaaa-0005-4000-8000-000000000005'::uuid,
    'multi-turn-bypass',
    'Multi-Turn Bypass',
    'Progressive multi-turn bypass sequences for conversational guardrail evasion.',
    '# ForgeGuard Certified — Multi-Turn Bypass\nprint("multi-turn bypass ready")',
    'python',
    ARRAY['multi-turn', 'bypass', 'llm'],
    v_author, true, 'cleared', true, false, 9, 38, 87, 131
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    code = EXCLUDED.code,
    language = EXCLUDED.language,
    tags = EXCLUDED.tags,
    is_certified = EXCLUDED.is_certified,
    audit_verdict = EXCLUDED.audit_verdict,
    is_published = EXCLUDED.is_published,
    is_removed = EXCLUDED.is_removed,
    price_usd = EXCLUDED.price_usd,
    audit_risk_score = EXCLUDED.audit_risk_score,
    safety_score = EXCLUDED.safety_score,
    purchase_count = EXCLUDED.purchase_count,
    updated_at = now();
END $$;
