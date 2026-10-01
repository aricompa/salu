"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { updateOrderSettingsAction, type OrderSettingsFormResult } from "./actions";

export function OrderSettingsForm({
  editWindowMins,
  additionCutoffMins,
  requireStaffOpen,
  disabled,
}: {
  editWindowMins: number;
  additionCutoffMins: number;
  requireStaffOpen: boolean;
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
        <div className="flex flex-col gap-1.5">
          <label className="flex min-h-11 items-center gap-3 font-medium">
            <input
              type="checkbox"
              name="requireStaffOpen"
              aria-describedby="require-staff-open-hint"
              className="size-6 accent-brand"
              defaultChecked={
                failure?.values ? failure.values.requireStaffOpen === "on" : requireStaffOpen
              }
            />
            Staff seat tables before diners can order
          </label>
          <p id="require-staff-open-hint" className="text-sm text-muted portal:text-base">
            A table&apos;s code takes orders only after someone taps Seat on the Orders page, so a
            photo of the code can&apos;t be used from home.
          </p>
        </div>
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
