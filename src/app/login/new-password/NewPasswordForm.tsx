"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { setNewPassword } from "@/lib/staff-auth-browser";
import { credentialsSchema } from "@/lib/validation/auth";

type State =
  | null
  | { kind: "saved" }
  | { kind: "failed"; field?: string; message?: string; expired?: boolean };

async function save(_prev: State, formData: FormData): Promise<State> {
  const parsed = credentialsSchema.shape.password.safeParse(formData.get("password"));
  if (!parsed.success) return { kind: "failed", field: parsed.error.issues[0].message };
  // In the browser, like sign-in (decision 12); Supabase Auth enforces the length too.
  const outcome = await setNewPassword(parsed.data);
  switch (outcome) {
    case "ok":
      // A full page load on purpose, so the proxy and Server Components read the session
      // cookies the browser client just wrote (a client-side push could race them).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/restaurant/dashboard");
      return { kind: "saved" };
    case "weak_password":
      return { kind: "failed", field: "Choose a stronger password." };
    case "same_password":
      return { kind: "failed", field: "Use a password you haven't used here before." };
    case "expired":
      return { kind: "failed", expired: true };
    default:
      return { kind: "failed", message: "Something went wrong. Try again in a moment." };
  }
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(save, null);
  const failure = state?.kind === "failed" ? state : null;
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters."
        error={failure?.field}
      />
      {failure?.message && (
        <p role="alert" className="text-danger">
          {failure.message}
        </p>
      )}
      {failure?.expired && (
        <p role="alert" className="text-danger">
          That reset link has expired.{" "}
          <a href="/login" className="underline underline-offset-4">
            Ask for a new one
          </a>
          .
        </p>
      )}
      <Button type="submit" loading={pending || state?.kind === "saved"}>
        Save new password
      </Button>
    </form>
  );
}
