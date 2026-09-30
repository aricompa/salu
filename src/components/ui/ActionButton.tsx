"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/errors";
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
}: {
  action: ButtonAction;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
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
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
