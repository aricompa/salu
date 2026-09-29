"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { signInAction, signUpAction, type LoginState } from "./actions";

type Mode = "sign-in" | "sign-up";

export function LoginForm({ notice }: { notice?: string }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [signInState, signIn, signingIn] = useActionState(signInAction, {} as LoginState);
  const [signUpState, signUp, signingUp] = useActionState(signUpAction, {} as LoginState);

  if (mode === "sign-up" && signUpState.sentTo) {
    return (
      <Card className="flex flex-col gap-3" role="status">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-muted">
          We sent a confirmation link to <strong className="text-text">{signUpState.sentTo}</strong>
          . Open it on this device to set up your restaurant.
        </p>
      </Card>
    );
  }

  const state = mode === "sign-in" ? signInState : signUpState;
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
            onClick={() => setMode(m)}
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
          defaultValue={state.email}
          error={state.fieldErrors?.email}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
          minLength={10}
          hint={mode === "sign-up" ? "At least 10 characters." : undefined}
          error={state.fieldErrors?.password}
        />
        {state.error && (
          <p role="alert" className="text-danger">
            {state.error}
          </p>
        )}
        <Button type="submit" loading={pending}>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
