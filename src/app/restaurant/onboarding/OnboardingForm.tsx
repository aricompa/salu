"use client";

import { useActionState, useState } from "react";
import { Button, Input } from "@/components/ui";
import { slugify } from "@/lib/validation/restaurant";
import { createRestaurantAction, type OnboardingState } from "./actions";

export function OnboardingForm({ siteUrl }: { siteUrl: string }) {
  const [state, action, pending] = useActionState(createRestaurantAction, {} as OnboardingState);
  const [name, setName] = useState(state.values?.name ?? "");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);
  const host = siteUrl.replace(/^https?:\/\//, "");

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Input
        label="Restaurant name"
        name="name"
        required
        maxLength={120}
        autoComplete="organization"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugEdited) setSlug(slugify(e.target.value));
        }}
        error={state.fieldErrors?.name}
      />
      <Input
        label="Link"
        name="slug"
        required
        maxLength={60}
        autoCapitalize="none"
        spellCheck={false}
        value={slug}
        onChange={(e) => {
          setSlugEdited(true);
          setSlug(e.target.value.toLowerCase());
        }}
        hint={`${host}/${slug || "casa-grande"} · lowercase letters, numbers and dashes`}
        error={state.fieldErrors?.slug}
      />
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending}>
        Create restaurant
      </Button>
    </form>
  );
}
