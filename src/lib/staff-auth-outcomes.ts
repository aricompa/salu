/**
 * What each staff auth call can come back with, mapped from Supabase Auth errors. Pure, so
 * the browser forms and the tests share one mapping.
 */
type AuthErrorLike = { code?: string | null; status?: number | null } | null | undefined;

const rateLimited = (e: NonNullable<AuthErrorLike>) =>
  e.status === 429 || (e.code ?? "").startsWith("over_");

export type SignInOutcome =
  | "ok"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "rate_limited"
  | "captcha_failed"
  | "error";

export function signInOutcome(error: AuthErrorLike): SignInOutcome {
  if (!error) return "ok";
  if (error.code === "captcha_failed") return "captcha_failed";
  if (error.code === "email_not_confirmed") return "email_not_confirmed";
  if (rateLimited(error)) return "rate_limited";
  if (error.code === "invalid_credentials" || error.status === 400) return "invalid_credentials";
  return "error";
}

export type SignUpOutcome =
  "check_email" | "weak_password" | "rate_limited" | "captcha_failed" | "error";

/** Supabase answers the same way whether or not the email exists: "check your email". */
export function signUpOutcome(error: AuthErrorLike): SignUpOutcome {
  if (!error) return "check_email";
  if (error.code === "captcha_failed") return "captcha_failed";
  if (error.code === "weak_password") return "weak_password";
  if (rateLimited(error)) return "rate_limited";
  return "error";
}

export type ResetOutcome = "sent" | "captcha_failed" | "offline";

/**
 * A reset request never says whether the account exists. Auth only rate-limits resends
 * (and only fails to send mail) for addresses it knows, so even "too many attempts" would
 * give one away: everything but a failed device check, or no connection at all (status 0,
 * the request never reached Auth), reads as "If an account exists for that email, we sent
 * a link".
 */
export function resetOutcome(error: AuthErrorLike): ResetOutcome {
  if (error?.code === "captcha_failed") return "captcha_failed";
  if (error?.status === 0) return "offline";
  return "sent";
}

export type NewPasswordOutcome = "ok" | "weak_password" | "same_password" | "expired" | "error";

export function newPasswordOutcome(error: AuthErrorLike): NewPasswordOutcome {
  if (!error) return "ok";
  if (error.code === "weak_password") return "weak_password";
  if (error.code === "same_password") return "same_password";
  if (
    error.code === "session_not_found" ||
    error.code === "session_expired" ||
    error.status === 401
  )
    return "expired";
  return "error";
}
