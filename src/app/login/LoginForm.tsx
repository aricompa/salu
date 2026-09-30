"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, Turnstile } from "@/components/ui";
import { signInAction, signUpAction, type SignInResult, type SignUpResult } from "./actions";

type Mode = "sign-in" | "sign-up";

export function LoginForm({
  notice,
  turnstileSiteKey,
}: {
  notice?: string;
  turnstileSiteKey: string;
}) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Turnstile tokens are single-use: every answer from the server gets a fresh widget.
  const [attempt, setAttempt] = useState(0);
  const spendToken = () => {
    setCaptchaToken(null);
    setAttempt((n) => n + 1);
  };
  const [signInState, signIn, signingIn] = useActionState(
    async (prev: SignInResult, formData: FormData) => {
      const result = await signInAction(prev, formData);
      spendToken();
      return result;
    },
    null as SignInResult,
  );
  const [signUpState, signUp, signingUp] = useActionState(
    async (prev: SignUpResult, formData: FormData) => {
      const result = await signUpAction(prev, formData);
      spendToken();
      return result;
    },
    null as SignUpResult,
  );

  if (mode === "sign-up" && signUpState?.ok) {
    return (
      <Card className="flex flex-col gap-3" role="status">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-muted">
          We sent a confirmation link to{" "}
          <strong className="text-text">{signUpState.data.sentTo}</strong>. Open it on this device
          to set up your restaurant.
        </p>
      </Card>
    );
  }

  const state = mode === "sign-in" ? signInState : signUpState;
  const failure = state && !state.ok ? state : null;
  // Field-level problems show next to the field; only other failures get a form-level message.
  const formError = failure && !failure.fieldErrors ? failure.error.message : null;
  const pending = mode === "sign-in" ? signingIn : signingUp;

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-2">
        {(["sign-in", "sign-up"] as const).map((m) => (
          <Button
            key={m}
            role="tab"
            aria-selected={mode === m}
            variant={mode === m ? "secondary" : "ghost"}
            onClick={() => {
              setMode(m);
              setCaptchaToken(null);
            }}
          >
            {m === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        ))}
      </div>

      {notice && (
        <p role="status" className="rounded-card border border-warning p-3 text-warning">
          {notice}
        </p>
      )}

      <form
        key={mode}
        action={mode === "sign-in" ? signIn : signUp}
        className="flex flex-col gap-4"
        noValidate
      >
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={failure?.values?.email}
          error={failure?.fieldErrors?.email}
        />
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
          loading={pending}
          disabled={!captchaToken}
          aria-describedby={captchaToken ? undefined : "captcha-wait"}
        >
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
        {!captchaToken && (
          <p id="captcha-wait" className="text-sm text-muted">
            Checking this device…
          </p>
        )}
      </form>
    </div>
  );
}
