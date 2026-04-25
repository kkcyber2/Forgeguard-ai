import { z } from "zod";

/**
 * Environment validation.
 * -----------------------
 * Public env (NEXT_PUBLIC_*) is validated at boot from the root layout.
 * Server-only secrets are validated lazily the first time they're read,
 * so public pages don't crash if an admin secret is missing.
 *
 * SECURITY RULE: do not re-export server-only values. Only export typed
 * getters, so it's impossible to accidentally reference `process.env.GROQ_API_KEY`
 * from a client component and ship it in the bundle.
 */

// ---- Public env (safe to expose to the browser) ----------------------------
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

let publicCache: z.infer<typeof PublicEnvSchema> | null = null;

export function assertPublicEnv(): z.infer<typeof PublicEnvSchema> {
  if (publicCache) return publicCache;
  const parsed = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  · ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[forgeguard:env] Public environment is invalid:\n${issues}\n` +
        `Check your .env.local against .env.example.`,
    );
  }
  publicCache = parsed.data;
  return publicCache;
}

export const publicEnv = new Proxy({} as z.infer<typeof PublicEnvSchema>, {
  get(_t, prop: string) {
    return assertPublicEnv()[prop as keyof z.infer<typeof PublicEnvSchema>];
  },
});

// ---- Server-only env (NEVER import from a client component) ---------------
const ServerEnvSchema = z.object({
  GROQ_API_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
});

let serverCache: z.infer<typeof ServerEnvSchema> | null = null;

export function getServerEnv(): z.infer<typeof ServerEnvSchema> {
  if (typeof window !== "undefined") {
    throw new Error(
      "[forgeguard:env] getServerEnv() called from the browser. This is a security bug. " +
        "Only import this helper from server components, route handlers, or server actions.",
    );
  }
  if (serverCache) return serverCache;
  const parsed = ServerEnvSchema.safeParse({
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  · ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`[forgeguard:env] Server environment is invalid:\n${issues}`);
  }
  serverCache = parsed.data;
  return serverCache;
}
