# ForgeGuard AI

**AI Red Teaming & Secure AI/ML Agency**

> Forging Secure AI | Red Teaming LLMs | Hardening Agents Against Real Attacks

A production-ready, full-stack web application for ForgeGuard AI — an AI security agency founded by Konain Sultan Khan.

![ForgeGuard AI](public/og-image.jpg)

## Features

- **Immersive 3D Hero Section** - Interactive neural network visualization with React Three Fiber
- **AI Chat Assistant** - Powered by Vercel AI SDK + Groq (Llama 3.3 70B)
- **Protected Client Portal** - Full dashboard with Supabase Auth
- **Real-time Features** - Live project updates and messaging
- **Red Teaming Demo** - Interactive prompt injection tester
- **PWA Ready** - Installable as a native app
- **Fully Responsive** - Optimized for all devices

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **3D Graphics**: React Three Fiber + Three.js + @react-three/drei
- **Animations**: Framer Motion + GSAP
- **Backend**: Supabase (Auth, Postgres, Realtime, Storage)
- **AI**: Vercel AI SDK + Groq API
- **State Management**: Zustand
- **UI Components**: shadcn/ui + Radix UI

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account
- Groq API key

### 1. Clone and Install

```bash
git clone <repository-url>
cd forgeguard-ai
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Groq
GROQ_API_KEY=your-groq-api-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup

1. Go to your Supabase project dashboard
2. Open the SQL Editor
3. Copy the contents of `sql/schema.sql`
4. Run the SQL to create all tables, policies, and seed data

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy!

```bash
# Using Vercel CLI
vercel --prod
```

### Supabase Production Setup

1. Create a new Supabase project for production
2. Run the schema.sql in the production project
3. Update environment variables with production credentials
4. Configure OAuth providers (Google) in Authentication settings

### Groq API Setup

1. Sign up at [console.groq.com](https://console.groq.com)
2. Create an API key
3. Add to environment variables

## Project Structure

```
forgeguard-ai/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── auth/           # Authentication pages
│   │   ├── dashboard/      # Client portal
│   │   ├── api/            # API routes
│   │   ├── page.tsx        # Landing page
│   │   └── layout.tsx      # Root layout
│   ├── components/
│   │   ├── chat/           # AI chat assistant
│   │   ├── portal/         # Dashboard components
│   │   └── ui/             # UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities & stores
│   ├── sections/           # Page sections
│   └── types/              # TypeScript types
├── sql/
│   └── schema.sql          # Database schema
├── public/                 # Static assets
└── docs/                   # Documentation
```

## Database Schema

### Tables

- **profiles** - User profiles extending Supabase Auth
- **projects** - Client projects
- **project_files** - Files attached to projects
- **messages** - Client-admin chat
- **bookings** - Service booking requests
- **services** - Available services
- **skills** - Technical skills
- **showcase_projects** - Portfolio projects
- **contact_submissions** - Contact form submissions
- **activity_logs** - Audit trail

### Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:
- Users can only access their own data
- Admin has full access
- Public tables (services, skills, showcase_projects) are readable by all

## Adding Real Projects

### 1. Via Supabase Dashboard

1. Go to Table Editor
2. Select `showcase_projects`
3. Click "Insert Row"
4. Fill in project details

### 2. Via SQL

```sql
INSERT INTO public.showcase_projects (
  title,
  slug,
  description,
  short_description,
  technologies,
  github_url,
  demo_url,
  category,
  is_featured,
  is_active
) VALUES (
  'Your Project Name',
  'your-project-slug',
  'Full description...',
  'Short description...',
  '["Tech1", "Tech2"]',
  'https://github.com/...',
  'https://demo...',
  'Category',
  true,
  true
);
```

## Customization

### Colors

Edit `src/app/globals.css`:

```css
--color-cyan: #00f0ff;      /* Primary accent */
--color-red: #ff0033;       /* Threat/Danger */
--color-background: #0a0a0a; /* Dark background */
```

### Content

- **Services**: Edit in Supabase `services` table
- **Skills**: Edit in Supabase `skills` table
- **Projects**: Edit in Supabase `showcase_projects` table
- **About/Bio**: Edit `src/sections/About.tsx`

### Fonts

Currently using Inter (body) and Space Grotesk (headings). Change in `src/app/layout.tsx`.

## API Routes

### Chat API

`POST /api/chat`

Request body:
```json
{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

## Performance Optimization

- 3D scene uses `dpr={[1, 2]}` for adaptive resolution
- Components lazy loaded with dynamic imports
- Images optimized with Next.js Image component
- PWA caching for offline support

## Security Considerations

- All API keys stored in environment variables
- RLS policies prevent unauthorized data access
- Input sanitization on all forms
- Rate limiting on API routes (implement as needed)
- HTTPS enforced in production

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT License - See LICENSE file

## Contact

Konain Sultan Khan
- Email: konain@forgeguard.ai
- GitHub: [@konainsultan](https://github.com/konainsultan)
- LinkedIn: [Konain Sultan Khan](https://linkedin.com/in/konainsultan)

---

Built with passion in Karachi, Pakistan
