"use server";

import { revalidatePath } from "next/cache";
import { fail, type FormResult } from "@/lib/errors";
import { managerMembership } from "@/lib/portal-access";
import { updateOrderSettings, updateRestaurantProfile } from "@/lib/settings";
import { fieldErrorsOf } from "@/lib/validation/fields";
import { orderSettingsSchema, restaurantProfileSchema } from "@/lib/validation/settings";

export type ProfileFormResult = FormResult<null, "name" | "timezone">;
export type OrderSettingsFormResult = FormResult<
  null,
  "editWindowMins" | "additionCutoffMins" | "requireStaffOpen"
>;

export async function updateProfileAction(
  _prev: ProfileFormResult,
  formData: FormData,
): Promise<ProfileFormResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const values = {
    name: String(formData.get("name") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
  };
  const parsed = restaurantProfileSchema.safeParse(values);
  if (!parsed.success)
    return { ...fail("invalid_input"), values, fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await updateRestaurantProfile(access.membership.restaurantId, parsed.data);
  if (!result.ok) {
    // Postgres and this runtime can disagree on zone names; the database has the last word.
    const fieldErrors =
      result.error.code === "invalid_timezone" ? { timezone: result.error.message } : undefined;
    return { ok: false, error: result.error, values, fieldErrors };
  }
  // The header shows the name and the kitchen clock, so refresh the whole portal.
  revalidatePath("/restaurant", "layout");
  return { ok: true, data: null };
}

export async function updateOrderSettingsAction(
  _prev: OrderSettingsFormResult,
  formData: FormData,
): Promise<OrderSettingsFormResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const values = {
    editWindowMins: String(formData.get("editWindowMins") ?? ""),
    additionCutoffMins: String(formData.get("additionCutoffMins") ?? ""),
    requireStaffOpen: String(formData.get("requireStaffOpen") ?? ""),
  };
  const parsed = orderSettingsSchema.safeParse(values);
  if (!parsed.success)
    return { ...fail("invalid_input"), values, fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await updateOrderSettings(access.membership.restaurantId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error, values };
  revalidatePath("/restaurant/settings");
  return { ok: true, data: null };
}
