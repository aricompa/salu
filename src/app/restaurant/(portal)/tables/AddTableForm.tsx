"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { createTableAction, type TableFormResult } from "./actions";

export function AddTableForm() {
  const [state, action, pending] = useActionState(createTableAction, null as TableFormResult);
  const failure = state && !state.ok ? state : null;
  const formError = failure && !failure.fieldErrors ? failure.error.message : null;

  return (
    <form action={action} noValidate className="flex flex-wrap items-start gap-3">
      <div className="w-40">
        <Input
          label="New table"
          name="label"
          maxLength={40}
          placeholder="A4"
          defaultValue={failure?.values?.label ?? ""}
          error={failure?.fieldErrors?.label}
        />
      </div>
      <div className="w-32">
        <Input
          label="Seats"
          name="capacity"
          inputMode="numeric"
          hint="Optional"
          defaultValue={failure?.values?.capacity ?? ""}
          error={failure?.fieldErrors?.capacity}
        />
      </div>
      <Button type="submit" loading={pending} className="mt-8">
        Add table
      </Button>
      {formError && (
        <p role="alert" className="w-full text-danger">
          {formError}
        </p>
      )}
    </form>
  );
}
