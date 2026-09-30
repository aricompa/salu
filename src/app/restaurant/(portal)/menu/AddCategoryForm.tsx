"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { createCategoryAction, type CategoryFormResult } from "./actions";

export function AddCategoryForm() {
  const [state, action, pending] = useActionState(createCategoryAction, null as CategoryFormResult);
  const failure = state && !state.ok ? state : null;
  const formError = failure && !failure.fieldErrors ? failure.error.message : null;

  // React resets the form after the action; echoing `values` as defaultValue keeps
  // the typed name on a failure and clears it on success.
  return (
    <form action={action} className="flex flex-wrap items-start gap-3" noValidate>
      <div className="min-w-60 flex-1">
        <Input
          label="New category"
          name="name"
          maxLength={60}
          placeholder="Starters"
          defaultValue={failure?.values?.name ?? ""}
          error={failure?.fieldErrors?.name}
        />
      </div>
      <Button type="submit" loading={pending} className="mt-8">
        Add category
      </Button>
      {formError && (
        <p role="alert" className="w-full text-danger">
          {formError}
        </p>
      )}
    </form>
  );
}
