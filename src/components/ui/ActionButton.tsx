"use client";

import { useActionState, type ReactNode } from "react";
import { fail, isConnectionFailure, type ActionResult } from "@/lib/errors";
import { Button, type ButtonProps } from "./Button";

export type ButtonAction = (
  prev: ActionResult<null> | null,
  formData: FormData,
) => Promise<ActionResult<null> | null>;

/**
 * A one-click Server Action (move, hide, deactivate). Posts its hidden fields,
 * shows pending state, and announces a failure next to the button.
 */
export function ActionButton({
  action,
  fields,
  children,
  variant = "secondary",
  disabled,
  className,
  onSuccess,
}: {
  action: ButtonAction;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  className?: string;
  /**
   * Runs when the action succeeds, inside the action: a success often moves or removes
   * this button (a card changing column), so an effect after render would never run.
   */
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult<null> | null, FormData>(
    async (prev, formData) => {
      // A dropped connection rejects the call: say so next to the button rather than
      // letting it replace the page (a board mid-service must stay up).
      const result = await action(prev, formData).catch((err: unknown) => {
        if (isConnectionFailure(err)) return fail("connection");
        throw err;
      });
      if (result?.ok) onSuccess?.();
      return result;
    },
    null,
  );
  const error = state && !state.ok ? state.error.message : null;
  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="submit"
        variant={variant}
        loading={pending}
        disabled={disabled}
        className={className}
      >
        {children}
      </Button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
