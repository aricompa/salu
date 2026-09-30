"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Input, Select, Textarea, buttonStyles } from "@/components/ui";
import { DIETARY_TAGS } from "@/lib/dietary";
import { saveItemAction, type ItemFormResult } from "./actions";

export type ItemFormDefaults = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  categoryId: string;
  dietaryTags: string[];
  isAvailable: boolean;
};

export function ItemForm({
  item,
  categories,
}: {
  item: ItemFormDefaults;
  categories: Array<{ id: string; name: string; is_active: boolean }>;
}) {
  const [state, action, pending] = useActionState(saveItemAction, null as ItemFormResult);
  const failure = state && !state.ok ? state : null;
  const echoed = failure?.values;
  const formError = failure && !failure.fieldErrors ? failure.error.message : null;
  // After a failed save React resets the form to these defaults, so they echo what was typed.
  const tags = echoed?.dietaryTags !== undefined ? echoed.dietaryTags.split(",") : item.dietaryTags;
  const isAvailable =
    echoed?.isAvailable !== undefined ? echoed.isAvailable === "on" : item.isAvailable;

  return (
    <form action={action} noValidate className="flex max-w-2xl flex-col gap-5">
      {item.id && <input type="hidden" name="id" value={item.id} />}
      <Input
        label="Name"
        name="name"
        required
        maxLength={120}
        defaultValue={echoed?.name ?? item.name}
        error={failure?.fieldErrors?.name}
      />
      <Textarea
        label="Description"
        name="description"
        maxLength={500}
        hint="Optional. Diners see the first two lines on the menu."
        defaultValue={echoed?.description ?? item.description}
        error={failure?.fieldErrors?.description}
      />
      <Input
        label="Price"
        name="price"
        required
        inputMode="decimal"
        autoComplete="off"
        hint="In dollars, like 12.50."
        defaultValue={echoed?.price ?? item.price}
        error={failure?.fieldErrors?.price}
        className="max-w-40"
      />
      <Select
        label="Category"
        name="categoryId"
        defaultValue={echoed?.categoryId ?? item.categoryId}
        hint="Items without a category don't show on the diner menu."
        error={failure?.fieldErrors?.categoryId}
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.is_active ? c.name : `${c.name} (hidden)`}
          </option>
        ))}
      </Select>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Dietary tags</legend>
        <div className="flex flex-wrap gap-2">
          {DIETARY_TAGS.map((tag) => (
            <label
              key={tag.value}
              className="inline-flex min-h-11 items-center gap-2 rounded-chip border border-border px-3"
            >
              <input
                type="checkbox"
                name="dietaryTags"
                value={tag.value}
                defaultChecked={tags.includes(tag.value)}
                className="size-5"
              />
              {tag.label}
            </label>
          ))}
        </div>
        {failure?.fieldErrors?.dietaryTags && (
          <p className="text-sm text-danger">{failure.fieldErrors.dietaryTags}</p>
        )}
      </fieldset>
      <label className="inline-flex min-h-11 items-center gap-3">
        <input type="checkbox" name="isAvailable" defaultChecked={isAvailable} className="size-5" />
        Available to order
      </label>
      {formError && (
        <p role="alert" className="text-danger">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          {item.id ? "Save changes" : "Add item"}
        </Button>
        <Link href="/restaurant/menu" className={buttonStyles("ghost")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
