import "server-only";
import type { Tables } from "@/lib/db/types";
import { toAppError, type ActionResult } from "@/lib/errors";
import { unorderableIds } from "@/lib/menu-addons";
import { createClient } from "@/lib/supabase/server";
import type { OrderInput } from "@/lib/validation/diner";

/** The diner's newest order in this session that isn't finished (RLS: own orders only). */
export async function getActiveOrderId(sessionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("session_id", sessionId)
    .not("status", "in", "(served,cancelled)")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** place_order: the only way an order is created (rule 4). The database prices every line. */
export async function placeOrder(
  sessionId: string,
  input: OrderInput,
): Promise<ActionResult<{ orderId: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_session_id: sessionId,
    p_items: input.lines.map((l) => ({
      menu_item_id: l.itemId,
      quantity: l.quantity,
      notes: l.notes === "" ? null : l.notes,
      addon_ids: l.addonIds,
    })),
    p_notes: input.notes === "" ? undefined : input.notes,
  });
  if (error || !data) return { ok: false, error: toAppError(error) };
  return { ok: true, data: { orderId: data } };
}

/**
 * Which items and add-ons in these lines can't be ordered right now, as place_order
 * decides (`unorderableIds`). place_order doesn't say which line failed, so after
 * item_unavailable the cart asks here and names them. Diners can't read a hidden category
 * at all (RLS), so its embed comes back empty.
 */
export async function unavailableAmong(
  restaurantId: string,
  lines: Array<{ itemId: string; addonIds: string[] }>,
): Promise<string[]> {
  const supabase = await createClient();
  const ids = [...new Set(lines.flatMap((l) => [l.itemId, ...l.addonIds]))];
  const [items, links] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, is_available, addon_only, menu_categories (is_active)")
      .eq("restaurant_id", restaurantId)
      .in("id", ids),
    supabase
      .from("menu_item_addons")
      .select("item_id, addon_id")
      .eq("restaurant_id", restaurantId)
      .in("item_id", [...new Set(lines.map((l) => l.itemId))]),
  ]);
  // A failed read names nothing: the diner gets the general message, not a wrong "sold out".
  if (items.error || links.error) return [];
  const orderable = new Map(
    items.data
      .filter((i) => i.is_available && i.menu_categories?.is_active)
      .map((i) => [i.id, i.addon_only]),
  );
  return unorderableIds(lines, orderable, links.data);
}

export async function getRestaurantCurrency(restaurantId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurants")
    .select("currency")
    .eq("id", restaurantId)
    .maybeSingle();
  return data?.currency ?? "usd";
}

export type DinerOrder = Pick<
  Tables<"orders">,
  | "id"
  | "session_id"
  | "status"
  | "subtotal_cents"
  | "notes"
  | "submitted_at"
  | "accepted_at"
  | "ready_at"
  | "served_at"
  | "cancelled_at"
> & {
  order_items: Array<
    Pick<
      Tables<"order_items">,
      "id" | "parent_id" | "item_name" | "unit_price_cents" | "quantity" | "notes"
    >
  >;
};

/** One of the diner's own orders with its lines (RLS: placed_by = the diner). */
export async function getDinerOrder(orderId: string): Promise<DinerOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, session_id, status, subtotal_cents, notes, submitted_at, accepted_at, ready_at, served_at, cancelled_at, order_items (id, parent_id, item_name, unit_price_cents, quantity, notes)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Could not load order: ${error.message}`);
  return data;
}
