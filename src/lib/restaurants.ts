import "server-only";
import { toAppError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

/** Creates a restaurant, its settings, and the caller's owner membership in one RPC. */
export async function createRestaurant(
  name: string,
  slug: string,
): Promise<ActionResult<{ restaurantId: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_restaurant", { p_name: name, p_slug: slug });
  if (error || !data) return { ok: false, error: toAppError(error) };
  return { ok: true, data: { restaurantId: data } };
}

export type SetupCounts = { menuItems: number; tables: number; orders: number };

/** Counts for the dashboard setup checklist, read through RLS. */
export async function getSetupCounts(restaurantId: string): Promise<SetupCounts> {
  const supabase = await createClient();
  const count = async (table: "menu_items" | "dining_tables" | "orders") => {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId);
    if (error) throw new Error(`Could not count ${table}: ${error.message}`);
    return count ?? 0;
  };
  const [menuItems, tables, orders] = await Promise.all([
    count("menu_items"),
    count("dining_tables"),
    count("orders"),
  ]);
  return { menuItems, tables, orders };
}
