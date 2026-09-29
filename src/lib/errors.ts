/** Shape every Server Action returns. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: AppError };

/**
 * Server Action result for forms: the same shape, plus per-field errors and the
 * submitted values on failure so the form can re-render them. `null` is the idle state.
 */
export type FormResult<T, F extends string> =
  | null
  | { ok: true; data: T }
  | {
      ok: false;
      error: AppError;
      fieldErrors?: Partial<Record<F, string>>;
      values?: Partial<Record<F, string>>;
    };

export type AppErrorCode =
  | "invalid_table"
  | "item_unavailable"
  | "session_closed"
  | "rate_limited"
  | "invalid_transition"
  | "not_participant"
  | "invalid_items"
  | "restaurant_limit"
  | "slug_taken"
  | "not_allowed"
  | "invalid_input"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "weak_password"
  | "too_many_attempts"
  | "unknown";

export type AppError = { code: AppErrorCode; message: string };

/** Friendly copy per error (PRD 5.7: short, warm, plain, says what to do next). */
export const ERROR_COPY: Record<AppErrorCode, string> = {
  invalid_table: "This table code isn't active. Ask your server for help.",
  item_unavailable: "Sorry, something in your order just sold out. We took it off your order.",
  session_closed: "This table was closed. Scan the code again to start a new tab.",
  rate_limited: "Slow down a moment, then try again.",
  invalid_transition: "That order already moved on. Refresh to see where it is.",
  not_participant: "Scan the code on your table to order.",
  invalid_items: "Something's off with your order. Check it and try again.",
  restaurant_limit: "You've reached the limit of restaurants for this account.",
  slug_taken: "That link is taken. Try another.",
  not_allowed: "You don't have access to do that.",
  invalid_input: "Check the highlighted fields and try again.",
  invalid_credentials: "Email or password is incorrect.",
  email_not_confirmed: "Confirm your email first. Check your inbox for the link.",
  weak_password: "Choose a stronger password.",
  too_many_attempts: "Too many attempts. Wait a minute, then try again.",
  unknown: "Something went wrong. Try again in a moment.",
};

/** Hints raised by the database (`raise ... using hint = '<code>'`). */
const DB_HINTS = new Set<AppErrorCode>([
  "invalid_table",
  "item_unavailable",
  "session_closed",
  "rate_limited",
  "invalid_transition",
  "not_participant",
  "invalid_items",
  "restaurant_limit",
]);

type DbErrorLike = { code?: string | null; hint?: string | null; message?: string | null };

export function toAppError(err: DbErrorLike | null | undefined): AppError {
  const hint = err?.hint as AppErrorCode | undefined;
  let code: AppErrorCode = "unknown";
  if (hint && DB_HINTS.has(hint)) code = hint;
  else if (err?.code === "23505") code = "slug_taken";
  else if (err?.code === "42501") code = "not_allowed";
  return { code, message: ERROR_COPY[code] };
}

export function fail(code: AppErrorCode): { ok: false; error: AppError } {
  return { ok: false, error: { code, message: ERROR_COPY[code] } };
}
