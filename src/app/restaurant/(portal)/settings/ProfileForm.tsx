"use client";

import { useActionState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { updateProfileAction, type ProfileFormResult } from "./actions";

export function ProfileForm({
  name,
  timezone,
  zones,
  disabled,
}: {
  name: string;
  timezone: string;
  /** Time zones grouped by region ("America", "Europe", ...). */
  zones: Array<{ region: string; ids: string[] }>;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, null as ProfileFormResult);
  const failure = state && !state.ok ? state : null;

  return (
    <form action={action} noValidate className="flex max-w-xl flex-col gap-4">
      <fieldset disabled={disabled} className="flex flex-col gap-4">
        <Input
          label="Restaurant name"
          name="name"
          maxLength={120}
          defaultValue={failure?.values?.name ?? name}
          error={failure?.fieldErrors?.name}
        />
        <Select
          label="Time zone"
          name="timezone"
          defaultValue={failure?.values?.timezone ?? timezone}
          hint="Order times on the staff board use this zone."
          error={failure?.fieldErrors?.timezone}
        >
          {zones.map((group) => (
            <optgroup key={group.region} label={group.region}>
              {group.ids.map((id) => (
                <option key={id} value={id}>
                  {id.replaceAll("_", " ")}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </fieldset>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>
            Save restaurant
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
