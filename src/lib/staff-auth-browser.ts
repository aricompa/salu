import { createClient } from "@/lib/supabase/client";
import {
  newPasswordOutcome,
  resetOutcome,
  signInOutcome,
  signUpOutcome,
  type NewPasswordOutcome,
  type ResetOutcome,
  type SignInOutcome,
  type SignUpOutcome,
} from "@/lib/staff-auth-outcomes";
import type { Credentials } from "@/lib/validation/auth";

/**
 * Staff auth calls, made from the browser (open decision 12, ruled 2026-09-30; an
 * exception to rule A4 for auth only). From a Server Action every staff member shared
 * Vercel's IP for Supabase's per-IP limits and CAPTCHA. Supabase Auth is the enforcing
 * check; getClaims() and RLS still guard every server path. The session lands in cookies,
 * so callers navigate with a full page load afterwards.
 */

/** Where the email links point. Inlined at build time; the browser can't read publicEnv(). */
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin).replace(/\/+$/, "");
}

/** Network failures and thrown errors read as "error", never as a crash. */
async function attempt<T>(call: () => Promise<T>, onThrow: T): Promise<T> {
  try {
    return await call();
  } catch {
    return onThrow;
  }
}

export function signInStaff(
  { email, password }: Credentials,
  captchaToken: string,
): Promise<SignInOutcome> {
  return attempt(async () => {
    const { error } = await createClient().auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });
    return signInOutcome(error);
  }, "error");
}

export function signUpStaff(
  { email, password }: Credentials,
  captchaToken: string,
): Promise<SignUpOutcome> {
  return attempt(async () => {
    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl()}/auth/confirm?next=/restaurant/onboarding`,
        captchaToken,
      },
    });
    return signUpOutcome(error);
  }, "error");
}

/** "Forgot password?": the link in the email lands on /auth/confirm with type=recovery. */
export function requestPasswordReset(email: string, captchaToken: string): Promise<ResetOutcome> {
  return attempt(async () => {
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl()}/auth/confirm`,
      captchaToken,
    });
    return resetOutcome(error);
  }, "offline");
}

/** Sets a new password for the signed-in staff member (the recovery link signed them in). */
export function setNewPassword(password: string): Promise<NewPasswordOutcome> {
  return attempt(async () => {
    const { error } = await createClient().auth.updateUser({ password });
    return newPasswordOutcome(error);
  }, "error");
}
