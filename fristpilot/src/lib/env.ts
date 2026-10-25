import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = z.object({
  ALLOWED_USER_EMAIL: z.email(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

// Next.js ersetzt NEXT_PUBLIC_* nur bei woertlichem Zugriff, daher kein process.env-Spread.
export function getPublicEnv(): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getServerEnv(source: Record<string, string | undefined> = process.env) {
  return serverSchema.parse({ ALLOWED_USER_EMAIL: source.ALLOWED_USER_EMAIL });
}

export function isAllowedEmail(email: string | undefined | null, allowed: string): boolean {
  return !!email && email.trim().toLowerCase() === allowed.trim().toLowerCase();
}
