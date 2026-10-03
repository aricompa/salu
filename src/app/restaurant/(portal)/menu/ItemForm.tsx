"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Input, Select, Textarea, buttonStyles } from "@/components/ui";
import { DIETARY_TAGS } from "@/lib/dietary";
import type { GoesWithGroup } from "@/lib/menu-addons";
import { saveItemAction, type ItemFormResult } from "./actions";

export type ItemFormDefaults = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  categoryId: string;
  dietaryTags: string[];
  isAvailable: boolean;
  addonOnly: boolean;
  goesWith: string[];
};

export function ItemForm({
  item,
  categories,
  goesWithGroups,
  offers,
  notice,
}: {
  item: ItemFormDefaults;
  categories: Array<{ id: string; name: string; is_active: boolean }>;
  /** Regular items this one could go with as an add-on, by category. */
  goesWithGroups: GoesWithGroup[];
  /** Names of the add-ons this item offers today, when it is a regular item. */
  offers: string[];
  notice?: string;
}) {
  const [state, action, pending] = useActionState(saveItemAction, null as ItemFormResult);
  const failure = state && !state.ok ? state : null;
  const echoed = failure?.values;
  const formError = failure && !failure.fieldErrors ? failure.error.message : null;
  // After a failed save React resets the form to these defaults, so they echo what was typed.
  const tags = echoed?.dietaryTags !== undefined ? echoed.dietaryTags.split(",") : item.dietaryTags;
  const isAvailable =
    echoed?.isAvailable !== undefined ? echoed.isAvailable === "on" : item.isAvailable;
  // Controlled, so the picker can show and hide, and keeps its picks after a failed save.
  const [addonOnly, setAddonOnly] = useState(item.addonOnly);
  const [goesWith, setGoesWith] = useState<ReadonlySet<string>>(new Set(item.goesWith));
  const pick = (ids: string[], on: boolean) =>
    setGoesWith((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

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
      <div className="flex flex-col gap-1">
        <label className="inline-flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="addonOnly"
            checked={addonOnly}
            onChange={(e) => setAddonOnly(e.target.checked)}
            aria-describedby="addon-only-hint"
            className="size-5"
          />
          Only sold as an add-on
        </label>
        {failure?.fieldErrors?.addonOnly && (
          <p className="text-sm text-danger portal:text-base">{failure.fieldErrors.addonOnly}</p>
        )}
        <p id="addon-only-hint" className="text-sm text-muted portal:text-base">
          Like &ldquo;Add Patty&rdquo;. Diners pick it inside the items it goes with, not from the
          menu list.
        </p>
        {addonOnly && offers.length > 0 && (
          <p className="text-warning">
            Its add-ons ({offers.join(", ")}) will stop being offered with it.
          </p>
        )}
        {!addonOnly && offers.length > 0 && (
          <p className="text-muted">
            Add-ons offered with it: {offers.join(", ")}. Edit an add-on to change where it&apos;s
            offered.
          </p>
        )}
      </div>
      {addonOnly && (
        <GoesWithPicker
          groups={goesWithGroups}
          picked={goesWith}
          onPick={pick}
          error={failure?.fieldErrors?.goesWith}
        />
      )}
      {notice && !failure && (
        <p role="status" className="text-warning">
          {notice}
        </p>
      )}
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

/** Which items an add-on goes with: grouped by category, with All and None per group. */
function GoesWithPicker({
  groups,
  picked,
  onPick,
  error,
}: {
  groups: GoesWithGroup[];
  picked: ReadonlySet<string>;
  onPick: (ids: string[], on: boolean) => void;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 font-medium">Goes with</legend>
      <p className="text-sm text-muted portal:text-base">
        Diners see it as a choice on these items. {picked.size} picked.
      </p>
      {error && <p className="text-sm text-danger portal:text-base">{error}</p>}
      {groups.length === 0 && <p className="text-muted">Add some menu items first.</p>}
      {groups.map((group) => {
        const ids = group.items.map((i) => i.id);
        return (
          <fieldset
            key={group.id}
            className="flex flex-col gap-1 rounded-card border border-border p-3"
          >
            <legend className="px-1 font-semibold">{group.name}</legend>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => onPick(ids, true)}>
                All <span className="sr-only">in {group.name}</span>
              </Button>
              <Button type="button" variant="ghost" onClick={() => onPick(ids, false)}>
                None <span className="sr-only">in {group.name}</span>
              </Button>
            </div>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {group.items.map((i) => (
                <label key={i.id} className="inline-flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    name="goesWith"
                    value={i.id}
                    checked={picked.has(i.id)}
                    onChange={(e) => onPick([i.id], e.target.checked)}
                    className="size-5"
                  />
                  {i.name}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </fieldset>
  );
}
