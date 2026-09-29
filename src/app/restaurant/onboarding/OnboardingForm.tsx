"use client";

import { useActionState, useState } from "react";
import { Button, Input } from "@/components/ui";
import { slugify } from "@/lib/validation/restaurant";
import { createRestaurantAction, type OnboardingResult } from "./actions";

export function OnboardingForm({ siteUrl }: { siteUrl: string }) {
  const [state, action, pending] = useActionState(createRestaurantAction, null as OnboardingResult);
  const failure = state && !state.ok ? state : null;
  const formError = failure && !failure.fieldErrors ? failure.error.message : null;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
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
        error={failure?.fieldErrors?.name}
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
        error={failure?.fieldErrors?.slug}
      />
      {formError && (
        <p role="alert" className="text-danger">
          {formError}
        </p>
      )}
      <Button type="submit" loading={pending}>
        Create restaurant
      </Button>
    </form>
  );
}
