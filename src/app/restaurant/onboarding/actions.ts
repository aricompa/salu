"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fail, type FormResult } from "@/lib/errors";
import { createRestaurant } from "@/lib/restaurants";
import { restaurantSchema } from "@/lib/validation/restaurant";

type Field = "name" | "slug";
export type OnboardingResult = FormResult<never, Field>;

export async function createRestaurantAction(
  _prev: OnboardingResult,
  formData: FormData,
): Promise<OnboardingResult> {
  await requireStaff();
  const values = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
  };
  const parsed = restaurantSchema.safeParse(values);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      ...fail("invalid_input"),
      values,
      fieldErrors: { name: errors.name?.[0], slug: errors.slug?.[0] },
    };
  }

  const result = await createRestaurant(parsed.data.name, parsed.data.slug);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      values,
      fieldErrors: result.error.code === "slug_taken" ? { slug: result.error.message } : undefined,
    };
  }
  redirect("/restaurant/dashboard");
}
