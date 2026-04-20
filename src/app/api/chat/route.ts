// =====================================================
// AI Chat API Route
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

// Initialize Groq client
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Rate limiting: IP-based request tracking (in-memory for MVP)
const rateLimit = new Map<
  string,
  { count: number; resetTime: number }
>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(
  process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '30',
  10
);

/**
 * Check rate limit for a given IP
 */
function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const record = rateLimit.get(clientIp);

  if (!record || now > record.resetTime) {
    // Create new record
    rateLimit.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Simple prompt injection detection
 */
function hasPromptInjection(text: string): boolean {
  const suspiciousPatterns = [
    /ignore previous prompts?/i,
    /forget previous instructions/i,
    /system overrid/i,
    /bypass.*restriction/i,
    /hidden system message/i,
    /original prompt/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(text));
}

// System prompt with ForgeGuard AI context
const SYSTEM_PROMPT = `You are the AI assistant for ForgeGuard AI, an AI security agency founded by Konain Sultan Khan.

ABOUT FORGEGUARD AI:
- Mission: Forging Secure AI | Red Teaming LLMs | Hardening Agents Against Real Attacks
- Founder: Konain Sultan Khan, 17, from Karachi, Pakistan
- Expertise: AI Red Teaming, LLM Security Audits, Secure AI Development

SERVICES OFFERED:
1. AI Red Teaming & LLM Security Audits ($1,500+, 1-2 weeks)
   - Prompt injection testing
   - Jailbreak attempts
   - Data extraction tests
   - Adversarial input analysis
   - Comprehensive security report

2. Secure AI Agents & Automation ($2,500+, 2-4 weeks)
   - Custom AI agent development
   - Multi-agent systems
   - Secure API integration
   - Input validation & sanitization

3. ML Model Hardening & Deployment ($3,000+, 3-6 weeks)
   - Adversarial training
   - Model encryption
   - Secure API deployment
   - Anomaly detection

4. Prompt Engineering with Security ($800+, 3-5 days)
   - System prompt design
   - Prompt injection mitigation
   - Output validation rules

5. Security Consultation ($200/hour)
   - Architecture security review
   - Threat modeling
   - Team training

FOUNDER BACKGROUND:
- Self-taught AI/ML engineer and cybersecurity specialist
- Harvard CS50 graduate
- Kali Linux expert
- 50+ security audits completed
- Full-stack developer (Python, TypeScript, Go, Rust)

TECHNICAL EXPERTISE:
- AI/ML: OpenAI GPT, LangChain, LlamaIndex, Hugging Face, PyTorch, TensorFlow
- Security: Kali Linux, Burp Suite, Metasploit, Wireshark, Nmap
- Deployment: Docker, Kubernetes, AWS/GCP/Azure, CI/CD

PROJECTS:
- PromptGuard: Real-time prompt injection detector
- RedTeamLLM: Automated adversarial testing framework
- SecureAgent: Production-ready secure AI assistant

CONTACT:
- Email: konain@forgeguard.ai
- Location: Karachi, Pakistan (available worldwide)
- Response time: Within 24 hours

GUIDELINES:
- Be professional, helpful, and knowledgeable about AI security
- Provide accurate pricing and timeline information
- Encourage users to book consultations for detailed discussions
- Direct technical questions to appropriate resources
- Maintain a security-first mindset in all recommendations`;

export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Get client IP for rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum ' + RATE_LIMIT_MAX_REQUESTS + ' requests per minute.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // Authenticate user (optional but recommended)
    // For public chat, we allow anonymous access but could require auth
    // Uncomment below to require authentication:
    /*
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to use the chat.' },
        { status: 401 }
      );
    }
    */

    // Parse request body
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid messages format' },
        { status: 400 }
      );
    }

    // Validate messages and check for prompt injection
    for (const msg of messages) {
      if (typeof msg.content !== 'string') {
        return NextResponse.json(
          { error: 'Invalid message format' },
          { status: 400 }
        );
      }

      if (hasPromptInjection(msg.content)) {
        return NextResponse.json(
          { error: 'Message contains suspicious patterns. Please rephrase your request.' },
          { status: 400 }
        );
      }
    }

    // Stream the response
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: SYSTEM_PROMPT,
      messages: messages as any,
      temperature: 0.7,
    } as any);

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Rate limiting headers
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
