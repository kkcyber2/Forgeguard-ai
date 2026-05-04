import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { Database } from '@/types/supabase';
import { sanitizeUserInput } from '@/lib/utils';

const submissionSchema = z.object({
  github_url: z.string().url().optional(),
  service_type: z.enum([
    'ai_red_teaming',
    'secure_ai_agents',
    'ml_hardening',
    'prompt_engineering',
    'consultation',
  ]),
  description: z.string().min(50).max(5000),
  budget_range: z.string().max(200).optional().nullable(),
  timeline: z.string().max(100).optional().nullable(),
});

function sanitizeSubmissionPayload(payload: z.infer<typeof submissionSchema>) {
  return {
    github_url: payload.github_url ? sanitizeUserInput(payload.github_url, 300) : null,
    service_type: payload.service_type,
    description: sanitizeUserInput(payload.description, 5000),
    budget_range: payload.budget_range ? sanitizeUserInput(payload.budget_range, 100) : null,
    timeline: payload.timeline ? sanitizeUserInput(payload.timeline, 100) : null,
    status: 'pending',
  };
}

async function getSupabase(request: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          // In API routes, we can't set cookies directly
          // This would need to be handled via response headers
        },
        remove(name: string, options: Record<string, unknown>) {
          // In API routes, we can't remove cookies directly
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const supabase = await getSupabase(request);
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = sessionData.session.user.id;
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileError || !profileData) {
    return NextResponse.json({ error: 'Unable to verify user role' }, { status: 500 });
  }

  const userRole = (profileData as any).role;
  const query = supabase
    .from('project_submissions')
    .select(`*, client:profiles!client_id(id, full_name, email, company_name)`)
    .order('created_at', { ascending: false });

  if (userRole !== 'admin') {
    query.eq('client_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabase(request);
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parseResult = submissionSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const sanitized = sanitizeSubmissionPayload(parseResult.data);

  const payload = {
    client_id: sessionData.session.user.id,
    ...sanitized,
  };

  const { data, error } = await supabase
    .from('project_submissions')
    .insert(payload as any)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
