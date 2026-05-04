import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { z } from 'zod';
import type { Database } from '@/types/supabase';

const contactFormSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(254),
  subject: z.string().min(5).max(200),
  message: z.string().min(10).max(5000),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

function sanitizeContactData(data: ContactFormData): ContactFormData {
  return {
    name: data.name.trim().slice(0, 100),
    email: data.email.trim().toLowerCase().slice(0, 254),
    subject: data.subject.trim().slice(0, 200),
    message: data.message.trim()
      .replace(/<[^>]*>/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .slice(0, 5000),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parseResult = contactFormSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const sanitized = sanitizeContactData(parseResult.data);

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('contact_submissions' as any)
      .insert([sanitized] as any);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to submit contact form' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Contact form submitted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}