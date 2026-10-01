"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import type { ActionResult } from "@/lib/errors";
import type { ButtonAction } from "./ActionButton";
import { Button, type ButtonProps } from "./Button";

/**
 * Confirmation for a destructive action, on the native <dialog>: showModal() traps
 * focus, Escape closes it, and focus returns to the trigger. Never window.confirm.
 */
export function ConfirmDialog({
  triggerLabel,
  triggerContext,
  triggerVariant = "secondary",
  title,
  body,
  confirmLabel,
  dismissLabel = "Cancel",
  action,
  fields,
  onDone,
}: {
  triggerLabel: string;
  /** Screen-reader-only words after the label, e.g. the item name: "Delete Lobster Roll". */
  triggerContext?: string;
  triggerVariant?: ButtonProps["variant"];
  title: string;
  body: string;
  confirmLabel: string;
  /** The button that closes without acting. Say "Keep order" when the action is a cancel. */
  dismissLabel?: string;
  action: ButtonAction;
  fields: Record<string, string>;
  /** Runs when the action succeeds, inside the action (see ActionButton's onSuccess). */
  onDone?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const [state, formAction, pending] = useActionState<ActionResult<null> | null, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result?.ok) onDone?.();
      return result;
    },
    null,
  );
  const error = state && !state.ok ? state.error.message : null;

  useEffect(() => {
    if (state?.ok) dialogRef.current?.close();
  }, [state]);

  return (
    <>
      <Button
        variant={triggerVariant}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
        {triggerContext && (
          <>
            {" "}
            <span className="sr-only">{triggerContext}</span>
          </>
        )}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-card border border-border bg-surface-raised p-6 text-text backdrop:bg-surface/80"
      >
        <form action={formAction} className="flex flex-col gap-4">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <p id={bodyId} className="text-muted">
            {body}
          </p>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              {dismissLabel}
            </Button>
            <Button type="submit" loading={pending}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
