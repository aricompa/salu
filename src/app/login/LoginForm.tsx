"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, Turnstile } from "@/components/ui";
import { ERROR_COPY, type AppErrorCode } from "@/lib/errors";
import { requestPasswordReset, signInStaff, signUpStaff } from "@/lib/staff-auth-browser";
import { credentialsSchema } from "@/lib/validation/auth";

type Mode = "sign-in" | "sign-up" | "reset";
type Field = "email" | "password";
type FormState =
  | null
  | { kind: "signing-in" }
  | { kind: "check-email"; to: string }
  | { kind: "reset-sent" }
  | {
      kind: "failed";
      message: string;
      email: string;
      fieldErrors?: Partial<Record<Field, string>>;
    };

const failed = (
  code: AppErrorCode,
  email: string,
  fieldErrors?: Partial<Record<Field, string>>,
): FormState => ({ kind: "failed", message: ERROR_COPY[code], email, fieldErrors });

const SIGN_IN_ERRORS = {
  captcha_failed: "captcha_failed",
  email_not_confirmed: "email_not_confirmed",
  rate_limited: "too_many_attempts",
  invalid_credentials: "invalid_credentials",
  error: "unknown",
} as const satisfies Record<string, AppErrorCode>;

/** One attempt from any of the three forms. Auth calls run in the browser (decision 12). */
async function submitStaffForm(mode: Mode, formData: FormData, next: string): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const captchaToken = String(formData.get("captchaToken") ?? "");

  if (mode === "reset") {
    const parsed = credentialsSchema.shape.email.safeParse(email);
    if (!parsed.success)
      return failed("invalid_input", email, { email: parsed.error.issues[0].message });
    if (!captchaToken) return failed("captcha_failed", email);
    const outcome = await requestPasswordReset(parsed.data, captchaToken);
    if (outcome === "sent") return { kind: "reset-sent" };
    return outcome === "captcha_failed"
      ? failed("captcha_failed", email)
      : { kind: "failed", email, message: "We couldn't reach Salu. Check your connection." };
  }

  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  if (mode === "sign-in") {
    // Don't reveal password rules on sign-in: any invalid input reads as bad credentials.
    if (!parsed.success) return failed("invalid_credentials", email);
    if (!captchaToken) return failed("captcha_failed", email);
    const outcome = await signInStaff(parsed.data, captchaToken);
    if (outcome !== "ok") return failed(SIGN_IN_ERRORS[outcome], email);
    // A full page load, so the proxy and Server Components see the new session cookies.
    window.location.assign(next);
    return { kind: "signing-in" };
  }

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return failed("invalid_input", email, {
      email: errors.email?.[0],
      password: errors.password?.[0],
    });
  }
  if (!captchaToken) return failed("captcha_failed", email);
  const outcome = await signUpStaff(parsed.data, captchaToken);
  switch (outcome) {
    case "check_email":
      return { kind: "check-email", to: parsed.data.email };
    case "weak_password":
      return failed("weak_password", email, { password: ERROR_COPY.weak_password });
    case "captcha_failed":
      return failed("captcha_failed", email);
    case "rate_limited":
      return failed("too_many_attempts", email);
    default:
      return failed("unknown", email);
  }
}

export function LoginForm({
  notice,
  turnstileSiteKey,
  next,
}: {
  notice?: string;
  turnstileSiteKey: string;
  /** Where to go after signing in: a same-origin path (safeNextPath). */
  next: string;
}) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Turnstile tokens are single-use: every answer from Auth gets a fresh widget.
  const [attempt, setAttempt] = useState(0);
  // Each switch between forms starts a new round; an answer only shows in its own round.
  const [round, setRound] = useState(0);
  const [answer, submit, pending] = useActionState(
    async (_prev: { round: number; result: FormState } | null, formData: FormData) => {
      const result = await submitStaffForm(mode, formData, next);
      if (result?.kind !== "signing-in") {
        setCaptchaToken(null);
        setAttempt((n) => n + 1);
      }
      return { round, result };
    },
    null,
  );
  const state = answer?.round === round ? answer.result : null;
  const switchTo = (m: Mode) => {
    setMode(m);
    setRound((n) => n + 1);
    setCaptchaToken(null);
  };

  if (state?.kind === "check-email") {
    return (
      <Card className="flex flex-col gap-3" role="status">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-muted">
          We sent a confirmation link to <strong className="text-text">{state.to}</strong>. Open it
          on this device to set up your restaurant.
        </p>
      </Card>
    );
  }
  if (state?.kind === "reset-sent") {
    return (
      <Card className="flex flex-col gap-3" role="status">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-muted">
          If an account exists for that email, we sent a link to set a new password. It works once,
          on this device.
        </p>
        <Button variant="ghost" onClick={() => switchTo("sign-in")} className="self-start">
          Back to sign in
        </Button>
      </Card>
    );
  }

  const failure = state?.kind === "failed" ? state : null;
  // Field-level problems show next to the field; only other failures get a form-level message.
  const formError = failure && !failure.fieldErrors ? failure.message : null;
  const busy = pending || state?.kind === "signing-in";
  const submitLabel =
    mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Send reset link";

  return (
    <div className="flex flex-col gap-6">
      {mode === "reset" ? (
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Reset your password</h2>
          <p className="text-muted">We&apos;ll email you a link to set a new one.</p>
        </div>
      ) : (
        <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-2">
          {(["sign-in", "sign-up"] as const).map((m) => (
            <Button
              key={m}
              role="tab"
              aria-selected={mode === m}
              variant={mode === m ? "secondary" : "ghost"}
              onClick={() => switchTo(m)}
            >
              {m === "sign-in" ? "Sign in" : "Create account"}
            </Button>
          ))}
        </div>
      )}

      {notice && (
        <p role="status" className="rounded-card border border-warning p-3 text-warning">
          {notice}
        </p>
      )}

      <form key={mode} action={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={failure?.email}
          error={failure?.fieldErrors?.email}
        />
        {mode !== "reset" && (
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            minLength={10}
            hint={mode === "sign-up" ? "At least 10 characters." : undefined}
            error={failure?.fieldErrors?.password}
          />
        )}
        <input type="hidden" name="captchaToken" value={captchaToken ?? ""} />
        <Turnstile
          key={`${mode}-${attempt}`}
          siteKey={turnstileSiteKey}
          action={mode}
          onToken={setCaptchaToken}
        />
        {formError && (
          <p role="alert" className="text-danger">
            {formError}
          </p>
        )}
        <Button
          type="submit"
          loading={busy}
          disabled={!captchaToken}
          aria-describedby={captchaToken ? undefined : "captcha-wait"}
        >
          {submitLabel}
        </Button>
        {!captchaToken && (
          <p id="captcha-wait" className="text-sm text-muted">
            Checking this device…
          </p>
        )}
      </form>

      {mode === "sign-in" && (
        <Button variant="ghost" onClick={() => switchTo("reset")} className="self-start">
          Forgot password?
        </Button>
      )}
      {mode === "reset" && (
        <Button variant="ghost" onClick={() => switchTo("sign-in")} className="self-start">
          Back to sign in
        </Button>
      )}
    </div>
  );
}
