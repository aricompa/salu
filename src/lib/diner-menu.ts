import "server-only";
import type { Tables } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

export type DinerItem = Pick<
  Tables<"menu_items">,
  "id" | "name" | "description" | "price_cents" | "is_available" | "dietary_tags"
>;
export type DinerCategory = { id: string; name: string; items: DinerItem[] };
export type DinerMenu = { currency: string; categories: DinerCategory[] };

/**
 * The menu diners see: active categories, and only items inside them (an item with no
 * category, or in a hidden one, is not offered). Sold-out items stay visible.
 */
export async function getDinerMenu(restaurantId: string): Promise<DinerMenu> {
  const supabase = await createClient();
  const [restaurant, categories, items] = await Promise.all([
    supabase.from("restaurants").select("currency").eq("id", restaurantId).single(),
    supabase
      .from("menu_categories")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("menu_items")
      .select("id, category_id, name, description, price_cents, is_available, dietary_tags")
      .eq("restaurant_id", restaurantId)
      .not("category_id", "is", null)
      .order("sort_order")
      .order("created_at"),
  ]);
  if (restaurant.error) throw new Error(`Could not load restaurant: ${restaurant.error.message}`);
  if (categories.error) throw new Error(`Could not load menu: ${categories.error.message}`);
  if (items.error) throw new Error(`Could not load menu items: ${items.error.message}`);

  return {
    currency: restaurant.data.currency,
    categories: categories.data
      .map((c) => ({
        id: c.id,
        name: c.name,
        items: items.data
          .filter((i) => i.category_id === c.id)
          .map((i) => ({
            id: i.id,
            name: i.name,
            description: i.description,
            price_cents: i.price_cents,
            is_available: i.is_available,
            dietary_tags: i.dietary_tags,
          })),
      }))
      .filter((c) => c.items.length > 0),
  };
}
