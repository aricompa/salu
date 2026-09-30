"use client";

import { useActionState, useState } from "react";
import { Button, Input } from "@/components/ui";
import { renameCategoryAction, type CategoryFormResult } from "./actions";

/** Category heading with an inline rename form for owners and managers. */
export function CategoryName({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: CategoryFormResult, formData: FormData) => {
      const result = await renameCategoryAction(prev, formData);
      if (result?.ok) setEditing(false);
      return result;
    },
    null as CategoryFormResult,
  );
  const failure = state && !state.ok ? state : null;

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-semibold">{name}</h2>
        <Button variant="ghost" onClick={() => setEditing(true)}>
          Rename <span className="sr-only">{name}</span>
        </Button>
      </div>
    );
  }

  return (
    <form
      action={action}
      noValidate
      className="flex flex-wrap items-start gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") setEditing(false);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <div className="min-w-56">
        <Input
          label={`Rename ${name}`}
          name="name"
          maxLength={60}
          autoFocus
          defaultValue={failure?.values?.name ?? name}
          error={
            failure?.fieldErrors?.name ??
            (failure && !failure.fieldErrors ? failure.error.message : undefined)
          }
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
    </form>
  );
}
