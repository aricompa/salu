import "server-only";
import { averageServeMinutes } from "@/lib/board";
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

export type LiveCounts = {
  openTables: number;
  ordersWaiting: number;
  servedToday: number;
  /** Sent to served, for orders served since `dayStart`; null before the first. */
  averageServeMinutes: number | null;
};

/** The dashboard's live counts (PRD P3), read through RLS. `dayStart` is the restaurant's midnight. */
export async function getLiveCounts(restaurantId: string, dayStart: Date): Promise<LiveCounts> {
  const supabase = await createClient();
  const [tables, waiting, served] = await Promise.all([
    supabase
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "open"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "submitted"),
    supabase
      .from("orders")
      .select("submitted_at, served_at")
      .eq("restaurant_id", restaurantId)
      .eq("status", "served")
      .gte("served_at", dayStart.toISOString())
      .limit(1000),
  ]);
  if (tables.error) throw new Error(`Could not count open tables: ${tables.error.message}`);
  if (waiting.error) throw new Error(`Could not count waiting orders: ${waiting.error.message}`);
  if (served.error) throw new Error(`Could not load served orders: ${served.error.message}`);
  return {
    openTables: tables.count ?? 0,
    ordersWaiting: waiting.count ?? 0,
    servedToday: served.data.length,
    averageServeMinutes: averageServeMinutes(served.data),
  };
}
