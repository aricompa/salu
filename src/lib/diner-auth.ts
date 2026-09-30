import { createClient } from "@/lib/supabase/client";

export type DinerSignIn = "ok" | "captcha_failed" | "rate_limited" | "error";

/**
 * Anonymous diner sign-in, in the browser on purpose: Supabase applies its sign-in limit
 * per IP, and from a Server Action every diner would share Vercel's IP (rule 2).
 */
export async function signInDiner(captchaToken: string): Promise<DinerSignIn> {
  try {
    const { error } = await createClient().auth.signInAnonymously({ options: { captchaToken } });
    if (!error) return "ok";
    if (error.code === "captcha_failed") return "captcha_failed";
    if (error.status === 429 || error.code === "over_request_rate_limit") return "rate_limited";
    return "error";
  } catch {
    return "error";
  }
}
