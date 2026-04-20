import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory rate limiting store
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limiting configuration
const RATE_LIMITS = {
  auth: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes for auth routes
  api: { max: 100, windowMs: 60 * 1000 }, // 100 requests per minute for API routes
  general: { max: 1000, windowMs: 60 * 1000 }, // 1000 requests per minute for general routes
};

function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (entry.count >= max) {
    return true;
  }

  entry.count++;
  return false;
}

function getRateLimitConfig(pathname: string) {
  if (pathname.startsWith('/auth/') || pathname.startsWith('/api/auth/')) {
    return RATE_LIMITS.auth;
  }
  if (pathname.startsWith('/api/')) {
    return RATE_LIMITS.api;
  }
  return RATE_LIMITS.general;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const key = `${ip}:${pathname}`;

  const config = getRateLimitConfig(pathname);

  if (isRateLimited(key, config.max, config.windowMs)) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil(config.windowMs / 1000).toString(),
        'Content-Type': 'text/plain',
      },
    });
  }

  // Payload size limits
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (pathname.startsWith('/api/')) {
      if (size > 1024 * 1024) { // 1MB for API routes
        return new NextResponse('Payload too large', { status: 413 });
      }
    } else {
      if (size > 10 * 1024 * 1024) { // 10MB for other routes
        return new NextResponse('Payload too large', { status: 413 });
      }
    }
  }

  // Add security headers
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self' https://*.supabase.co https://api.groq.com; " +
    "frame-ancestors 'none';"
  );

  // CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || 'http://localhost:3000');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
