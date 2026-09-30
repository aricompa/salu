"use client";

import { useActionState, useState } from "react";
import { Button, Input } from "@/components/ui";
import { updateTableAction, type TableFormResult } from "./actions";

/** Table label and seats, with an inline edit form for owners and managers. */
export function TableDetails({
  id,
  label,
  capacity,
  manage,
}: {
  id: string;
  label: string;
  capacity: number | null;
  manage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: TableFormResult, formData: FormData) => {
      const result = await updateTableAction(prev, formData);
      if (result?.ok) setEditing(false);
      return result;
    },
    null as TableFormResult,
  );
  const failure = state && !state.ok ? state : null;
  const seats =
    capacity === null ? "Seats not set" : `${capacity} ${capacity === 1 ? "seat" : "seats"}`;

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-3xl font-semibold">{label}</h2>
        <span className="text-muted">{seats}</span>
        {manage && (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit <span className="sr-only">{label}</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <form
      action={action}
      noValidate
      className="flex flex-wrap items-start gap-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") setEditing(false);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <div className="w-40">
        <Input
          label={`Name for ${label}`}
          name="label"
          maxLength={40}
          autoFocus
          defaultValue={failure?.values?.label ?? label}
          error={failure?.fieldErrors?.label}
        />
      </div>
      <div className="w-32">
        <Input
          label="Seats"
          name="capacity"
          inputMode="numeric"
          defaultValue={failure?.values?.capacity ?? (capacity === null ? "" : String(capacity))}
          error={failure?.fieldErrors?.capacity}
        />
      </div>
      <div className="mt-8 flex gap-2">
        <Button type="submit" loading={pending}>
          Save
        </Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {failure && !failure.fieldErrors && (
        <p role="alert" className="w-full text-danger">
          {failure.error.message}
        </p>
      )}
    </form>
  );
}
