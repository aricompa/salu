"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { updateOrderSettingsAction, type OrderSettingsFormResult } from "./actions";

export function OrderSettingsForm({
  editWindowMins,
  additionCutoffMins,
  disabled,
}: {
  editWindowMins: number;
  additionCutoffMins: number;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateOrderSettingsAction,
    null as OrderSettingsFormResult,
  );
  const failure = state && !state.ok ? state : null;

  return (
    <form action={action} noValidate className="flex max-w-xl flex-col gap-4">
      <fieldset disabled={disabled} className="flex flex-col gap-4">
        <Input
          label="Edit window (minutes)"
          name="editWindowMins"
          inputMode="numeric"
          className="max-w-32"
          hint="How long a diner can change an order after sending it. 0 turns editing off. Up to 30."
          defaultValue={failure?.values?.editWindowMins ?? String(editWindowMins)}
          error={failure?.fieldErrors?.editWindowMins}
        />
        <Input
          label="Add-on cutoff (minutes)"
          name="additionCutoffMins"
          inputMode="numeric"
          className="max-w-32"
          hint="Orders this long after a table's first order get flagged as late add-ons. Saved now; the flag arrives in a later update. Up to 240."
          defaultValue={failure?.values?.additionCutoffMins ?? String(additionCutoffMins)}
          error={failure?.fieldErrors?.additionCutoffMins}
        />
      </fieldset>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>
            Save order settings
          </Button>
          <p role="status" className="text-success">
            {state?.ok ? "Saved." : ""}
          </p>
        </div>
      )}
      {failure && !failure.fieldErrors && (
        <p role="alert" className="text-danger">
          {failure.error.message}
        </p>
      )}
    </form>
  );
}
