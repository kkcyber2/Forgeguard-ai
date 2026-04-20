# ForgeGuard AI - Deployment Guide

This guide will walk you through deploying ForgeGuard AI to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Groq API Setup](#groq-api-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Post-Deployment](#post-deployment)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Supabase account (free tier works)
- Groq account (free tier available)
- Domain name (optional, for custom domain)

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Enter project details:
   - Name: `forgeguard-ai`
   - Database Password: (generate strong password)
   - Region: Choose closest to your users
4. Click "Create New Project"

### 2. Get API Keys

1. Go to Project Settings → API
2. Copy these values:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Run Database Schema

1. Go to SQL Editor
2. Click "New Query"
3. Copy entire contents of `sql/schema.sql`
4. Paste and click "Run"
5. Verify tables created in Table Editor

### 4. Configure Auth

#### Email Provider (Default)

1. Go to Authentication → Providers
2. Email provider is enabled by default
3. Customize email templates if desired

#### Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase Google provider settings

### 5. Configure Storage (Optional)

For file uploads in projects:

1. Go to Storage
2. Create new bucket: `project-files`
3. Set public bucket policy
4. Add RLS policies for authenticated uploads

## Groq API Setup

### 1. Create Account

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up with email or Google
3. Verify email

### 2. Get API Key

1. Go to API Keys section
2. Click "Create API Key"
3. Name it: `forgeguard-ai-production`
4. Copy the key → `GROQ_API_KEY`

### 3. Select Model

The app uses `llama-3.3-70b-versatile` by default. You can change this in the chat API route.

## Vercel Deployment

### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Select the `forgeguard-ai` project

### 2. Configure Project

**Framework Preset**: Next.js

**Build Settings**:
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

### 3. Environment Variables

Add all these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GROQ_API_KEY=your-groq-api-key
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### 4. Deploy

1. Click "Deploy"
2. Wait for build to complete (2-5 minutes)
3. Visit the deployed URL

### 5. Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your domain: `forgeguard.ai`
3. Follow DNS configuration instructions
4. Wait for SSL certificate provisioning

## Post-Deployment

### 1. Verify Database Connection

1. Visit your deployed app
2. Try signing up a test user
3. Check Supabase Table Editor for new profile

### 2. Test All Features

- [ ] User registration/login
- [ ] Google OAuth (if configured)
- [ ] Contact form submission
- [ ] AI chat assistant
- [ ] Dashboard navigation
- [ ] Project creation (as admin)

### 3. Configure Admin User

Make your account an admin:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### 4. Add Real Content

1. Log in to your app
2. Go to dashboard
3. Add real projects, services, skills via Supabase
4. Or use SQL inserts

### 5. SEO Optimization

1. Update `src/app/layout.tsx` metadata
2. Add your domain to `openGraph.url`
3. Generate and upload `public/og-image.jpg`
4. Submit sitemap to Google Search Console

## Environment-Specific Configuration

### Development

```env
NEXT_PUBLIC_SUPABASE_URL=https://dev-project.supabase.co
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Staging

```env
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_APP_URL=https://staging.forgeguard.ai
```

### Production

```env
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_APP_URL=https://forgeguard.ai
```

## Troubleshooting

### Build Errors

**Error: "Module not found"**
- Run `npm install` locally
- Check all imports are correct
- Verify file paths are correct (case-sensitive)

**Error: "TypeScript errors"**
- Run `npx tsc --noEmit` to check types
- Fix any type errors before deploying

### Runtime Errors

**Error: "Supabase URL is required"**
- Verify environment variables in Vercel dashboard
- Check variable names match exactly
- Redeploy after adding variables

**Error: "Invalid API key"**
- Verify Supabase anon key is correct
- Check for extra spaces in environment variable
- Regenerate key if necessary

**Error: "RLS policy violation"**
- Check RLS policies in Supabase
- Verify user is authenticated
- Review policy conditions

### Database Issues

**Tables not created**
- Re-run schema.sql in SQL Editor
- Check for SQL errors
- Verify all extensions are enabled

**Data not persisting**
- Check RLS policies allow inserts
- Verify foreign key constraints
- Check for trigger errors

### Performance Issues

**Slow 3D rendering**
- Reduce particle count in Hero
- Lower dpr setting
- Disable effects on mobile

**Slow API responses**
- Check Groq API status
- Implement response caching
- Add loading states

## Security Checklist

- [ ] All API keys in environment variables
- [ ] RLS policies enabled on all tables
- [ ] Service role key never exposed to client
- [ ] HTTPS enforced
- [ ] Rate limiting implemented
- [ ] Input validation on all forms
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented

## Maintenance

### Regular Tasks

- Monitor Supabase usage quotas
- Check Vercel analytics
- Review error logs
- Update dependencies monthly
- Backup database weekly

### Updating

```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

## Support

For issues or questions:
- GitHub Issues: [repository-url]/issues
- Email: konain@forgeguard.ai
- Documentation: [docs-url]

---

Last updated: 2024
