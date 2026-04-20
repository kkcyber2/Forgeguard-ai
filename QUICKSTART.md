# ForgeGuard AI - Quick Start Guide

Get your ForgeGuard AI website running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Git

## Step 1: Install Dependencies

```bash
cd forgeguard-ai
npm install
```

## Step 2: Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your credentials:

For **demo/development** (without Supabase):
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For **full functionality**, you'll need:
- Supabase project (free at supabase.com)
- Groq API key (free at console.groq.com)

## Step 3: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 4: Build for Production

```bash
npm run build
```

## Full Setup (All Features)

### 1. Supabase Setup

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to SQL Editor
4. Copy contents of `sql/schema.sql`
5. Run the SQL
6. Copy API keys from Project Settings → API

### 2. Groq Setup

1. Sign up at [console.groq.com](https://console.groq.com)
2. Create API key
3. Add to `.env.local`

### 3. Update Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Deploy to Vercel

### Option 1: Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

### Option 2: GitHub Integration

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import repository
4. Add environment variables
5. Deploy!

## Project Structure

```
forgeguard-ai/
├── src/
│   ├── app/           # Next.js pages
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   ├── lib/           # Utilities
│   ├── sections/      # Page sections
│   └── types/         # TypeScript types
├── sql/
│   └── schema.sql     # Database schema
├── public/            # Static assets
└── docs/              # Documentation
```

## Customization

### Change Colors

Edit `tailwind.config.ts`:
```ts
colors: {
  cyan: "#00f0ff",    // Primary accent
  red: "#ff0033",     // Secondary accent
  background: "#0a0a0a",
}
```

### Update Content

- **About**: Edit `src/sections/About.tsx`
- **Services**: Edit in Supabase `services` table
- **Projects**: Edit in Supabase `showcase_projects` table

### Add Your Photo

Replace avatar in `src/sections/About.tsx`:
```tsx
<img src="/your-photo.jpg" alt="Konain Sultan Khan" />
```

## Troubleshooting

### Port already in use
```bash
npm run dev -- --port 3001
```

### Build errors
```bash
rm -rf .next node_modules
npm install
npm run build
```

### TypeScript errors
```bash
npx tsc --noEmit
```

## Need Help?

- Read full docs in `docs/DEPLOYMENT.md`
- Check `README.md` for detailed info
- Email: konain@forgeguard.ai

---

**You're all set!** 🚀

Your ForgeGuard AI website is ready to impress clients and showcase your AI security expertise.
