import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(72, "Use 72 characters or fewer."),
});

export type Credentials = z.infer<typeof credentialsSchema>;

/** Only same-origin, absolute paths are allowed as post-auth redirects. */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}

/** A Turnstile token as posted by a form. Opaque to us; Supabase Auth verifies it. */
export const captchaTokenSchema = z.string().min(1).max(4096);
