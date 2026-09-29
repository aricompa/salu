"use server";

import { redirect } from "next/navigation";
import { signInStaff, signUpStaff } from "@/lib/staff-auth";
import { credentialsSchema } from "@/lib/validation/auth";

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  email?: string;
  sentTo?: string;
};

const GENERIC_SIGN_IN_ERROR = "Email or password is incorrect.";

export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  // Don't reveal password rules on sign-in: any invalid input reads as bad credentials.
  if (!parsed.success) return { error: GENERIC_SIGN_IN_ERROR, email };

  const outcome = await signInStaff(parsed.data);
  switch (outcome) {
    case "ok":
      redirect("/restaurant/dashboard");
    case "email_not_confirmed":
      return { error: "Confirm your email first. Check your inbox for the link.", email };
    case "rate_limited":
      return { error: "Too many attempts. Wait a minute, then try again.", email };
    case "invalid_credentials":
      return { error: GENERIC_SIGN_IN_ERROR, email };
    default:
      return { error: "Something went wrong. Try again in a moment.", email };
  }
}

export async function signUpAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      email,
      fieldErrors: { email: errors.email?.[0], password: errors.password?.[0] },
    };
  }

  const outcome = await signUpStaff(parsed.data);
  switch (outcome) {
    case "check_email":
      return { sentTo: parsed.data.email };
    case "weak_password":
      return { email, fieldErrors: { password: "Choose a stronger password." } };
    case "rate_limited":
      return { email, error: "Too many attempts. Wait a minute, then try again." };
    default:
      return { email, error: "Something went wrong. Try again in a moment." };
  }
}
