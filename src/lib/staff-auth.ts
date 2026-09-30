import "server-only";
import { publicEnv } from "@/lib/env";
import { isStaffClaims } from "@/lib/staff-claims";
import { createClient } from "@/lib/supabase/server";
import type { Credentials } from "@/lib/validation/auth";

export type SignInOutcome =
  "ok" | "invalid_credentials" | "email_not_confirmed" | "rate_limited" | "error";

export async function signInStaff({ email, password }: Credentials): Promise<SignInOutcome> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return "ok";
  if (error.code === "email_not_confirmed") return "email_not_confirmed";
  if (error.status === 429) return "rate_limited";
  if (error.code === "invalid_credentials" || error.status === 400) return "invalid_credentials";
  return "error";
}

export type SignUpOutcome = "check_email" | "weak_password" | "rate_limited" | "error";

/**
 * Starts staff sign-up. Supabase answers the same way whether or not the
 * email already exists, so the caller always shows "check your email".
 */
export async function signUpStaff({ email, password }: Credentials): Promise<SignUpOutcome> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/restaurant/onboarding`,
    },
  });
  if (!error) return "check_email";
  if (error.code === "weak_password") return "weak_password";
  if (error.status === 429) return "rate_limited";
  return "error";
}

const EMAIL_OTP_TYPES = ["email", "signup", "recovery", "invite", "email_change"] as const;
type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function isEmailOtpType(value: string | null): value is EmailOtpType {
  return !!value && (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}

/** Exchanges the token_hash from a confirmation email for a session. */
export async function verifyEmailToken(tokenHash: string, type: EmailOtpType): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  return !error;
}

export async function signOutStaff(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/** True when the caller already has a permanent (non-anonymous) session. */
export async function isSignedInStaff(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return isStaffClaims(data?.claims);
}
