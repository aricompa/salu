import { z } from "zod";

/**
 * Browser-safe environment. Each variable is referenced literally so Next.js
 * can inline it into client bundles. Only these names may carry NEXT_PUBLIC_.
 */
export const PUBLIC_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
] as const;

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1)
    .refine((v) => !v.startsWith("sb_secret_"), "a secret key must never be public"),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid public environment: ${issues}`);
  }
  return result.data;
}

const SECRET_LOOKING = /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)/;

/**
 * Server-side boot check: refuse unexpected or secret-looking NEXT_PUBLIC_ names,
 * because anything with that prefix can end up in the browser bundle.
 */
export function assertSafePublicEnvNames(source: Record<string, string | undefined>): void {
  const allowed = new Set<string>(PUBLIC_ENV_NAMES);
  const bad = Object.keys(source).filter(
    (name) => name.startsWith("NEXT_PUBLIC_") && (!allowed.has(name) || SECRET_LOOKING.test(name)),
  );
  if (bad.length > 0) {
    throw new Error(
      `Refusing to start: unexpected NEXT_PUBLIC_ variables ${bad.join(", ")}. ` +
        "Only allow-listed names in src/lib/env.ts may be public.",
    );
  }
}

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  cached ??= parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  return cached;
}
