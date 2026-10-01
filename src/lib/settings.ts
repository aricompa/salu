import "server-only";
import type { ActionResult } from "@/lib/errors";
import { oneRowChanged } from "@/lib/mutations";
import { createClient } from "@/lib/supabase/server";
import type { OrderSettingsInput, RestaurantProfileInput } from "@/lib/validation/settings";

export type RestaurantSettings = {
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  editWindowMins: number;
  additionCutoffMins: number;
  requireStaffOpen: boolean;
};

export async function getSettings(restaurantId: string): Promise<RestaurantSettings> {
  const supabase = await createClient();
  const [restaurant, settings] = await Promise.all([
    supabase
      .from("restaurants")
      .select("name, slug, timezone, currency")
      .eq("id", restaurantId)
      .single(),
    supabase
      .from("restaurant_settings")
      .select("order_edit_window_mins, order_addition_cutoff_mins, require_staff_open")
      .eq("restaurant_id", restaurantId)
      .single(),
  ]);
  if (restaurant.error) throw new Error(`Could not load restaurant: ${restaurant.error.message}`);
  if (settings.error) throw new Error(`Could not load settings: ${settings.error.message}`);
  return {
    ...restaurant.data,
    editWindowMins: settings.data.order_edit_window_mins,
    additionCutoffMins: settings.data.order_addition_cutoff_mins,
    requireStaffOpen: settings.data.require_staff_open,
  };
}

export async function updateRestaurantProfile(
  restaurantId: string,
  input: RestaurantProfileInput,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  return oneRowChanged(
    await supabase
      .from("restaurants")
      .update({ name: input.name, timezone: input.timezone })
      .eq("id", restaurantId)
      .select("id"),
  );
}

export async function updateOrderSettings(
  restaurantId: string,
  input: OrderSettingsInput,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  return oneRowChanged(
    await supabase
      .from("restaurant_settings")
      .update({
        order_edit_window_mins: input.editWindowMins,
        order_addition_cutoff_mins: input.additionCutoffMins,
        require_staff_open: input.requireStaffOpen,
      })
      .eq("restaurant_id", restaurantId)
      .select("restaurant_id"),
  );
}
