import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { Database } from '@/types/supabase';

// Input validation and sanitization
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function validateContactForm(data: any) {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.length < 2 || data.name.length > 100) {
    errors.push('Name must be between 2 and 100 characters');
  }

  if (!data.email || !validateEmail(data.email)) {
    errors.push('Valid email is required');
  }

  if (!data.subject || typeof data.subject !== 'string' || data.subject.length < 5 || data.subject.length > 200) {
    errors.push('Subject must be between 5 and 200 characters');
  }

  if (!data.message || typeof data.message !== 'string' || data.message.length < 10 || data.message.length > 5000) {
    errors.push('Message must be between 10 and 5000 characters');
  }

  return errors;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationErrors = validateContactForm(body);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedData: Database['public']['Tables']['contact_submissions']['Insert'] = {
      name: sanitizeInput(body.name),
      email: sanitizeInput(body.email),
      subject: sanitizeInput(body.subject),
      message: sanitizeInput(body.message),
    };

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Insert into database
    const { error } = await supabase
      .from('contact_submissions' as any)
      .insert([sanitizedData] as any);

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