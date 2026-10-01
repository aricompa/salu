import "server-only";
import { isStaffClaims } from "@/lib/staff-claims";
import { createClient } from "@/lib/supabase/server";

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
