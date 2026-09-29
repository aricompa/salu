"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createRestaurant } from "@/lib/restaurants";
import { restaurantSchema } from "@/lib/validation/restaurant";

export type OnboardingState = {
  values?: { name: string; slug: string };
  fieldErrors?: { name?: string; slug?: string };
  error?: string;
};

export async function createRestaurantAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  await requireStaff();
  const values = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
  };
  const parsed = restaurantSchema.safeParse(values);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { values, fieldErrors: { name: errors.name?.[0], slug: errors.slug?.[0] } };
  }

  const result = await createRestaurant(parsed.data.name, parsed.data.slug);
  if (!result.ok) {
    if (result.error.code === "slug_taken") {
      return { values, fieldErrors: { slug: result.error.message } };
    }
    return { values, error: result.error.message };
  }
  redirect("/restaurant/dashboard");
}
