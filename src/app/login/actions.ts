"use server";

import { redirect } from "next/navigation";
import { fail, type FormResult } from "@/lib/errors";
import { signInStaff, signUpStaff } from "@/lib/staff-auth";
import { credentialsSchema } from "@/lib/validation/auth";

type Field = "email" | "password";
export type SignInResult = FormResult<never, Field>;
export type SignUpResult = FormResult<{ sentTo: string }, Field>;

export async function signInAction(_prev: SignInResult, formData: FormData): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  // Don't reveal password rules on sign-in: any invalid input reads as bad credentials.
  if (!parsed.success) return { ...fail("invalid_credentials"), values: { email } };

  const outcome = await signInStaff(parsed.data);
  if (outcome === "ok") redirect("/restaurant/dashboard");
  const code =
    outcome === "email_not_confirmed"
      ? "email_not_confirmed"
      : outcome === "rate_limited"
        ? "too_many_attempts"
        : outcome === "invalid_credentials"
          ? "invalid_credentials"
          : "unknown";
  return { ...fail(code), values: { email } };
}

export async function signUpAction(_prev: SignUpResult, formData: FormData): Promise<SignUpResult> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      ...fail("invalid_input"),
      values: { email },
      fieldErrors: { email: errors.email?.[0], password: errors.password?.[0] },
    };
  }

  const outcome = await signUpStaff(parsed.data);
  switch (outcome) {
    case "check_email":
      return { ok: true, data: { sentTo: parsed.data.email } };
    case "weak_password": {
      const failure = fail("weak_password");
      return { ...failure, values: { email }, fieldErrors: { password: failure.error.message } };
    }
    case "rate_limited":
      return { ...fail("too_many_attempts"), values: { email } };
    default:
      return { ...fail("unknown"), values: { email } };
  }
}
