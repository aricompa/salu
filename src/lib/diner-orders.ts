import "server-only";
import { toAppError, type ActionResult } from "@/lib/errors";
import type { OrderStatus } from "@/lib/order-status";
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
    })),
    p_notes: input.notes === "" ? undefined : input.notes,
  });
  if (error || !data) return { ok: false, error: toAppError(error) };
  return { ok: true, data: { orderId: data } };
}

/**
 * Which of these items can't be ordered right now (sold out or deleted). place_order
 * doesn't say which line failed, so after item_unavailable the cart asks here and names them.
 */
export async function unavailableAmong(restaurantId: string, itemIds: string[]): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("menu_items")
    .select("id, is_available")
    .eq("restaurant_id", restaurantId)
    .in("id", itemIds);
  const available = new Set((data ?? []).filter((i) => i.is_available).map((i) => i.id));
  return itemIds.filter((id) => !available.has(id));
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

export type DinerOrder = {
  id: string;
  session_id: string;
  status: OrderStatus;
  subtotal_cents: number;
  notes: string | null;
  submitted_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  cancelled_at: string | null;
  order_items: Array<{
    id: string;
    item_name: string;
    unit_price_cents: number;
    quantity: number;
    notes: string | null;
  }>;
};

/** One of the diner's own orders with its lines (RLS: placed_by = the diner). */
export async function getDinerOrder(orderId: string): Promise<DinerOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, session_id, status, subtotal_cents, notes, submitted_at, accepted_at, ready_at, served_at, cancelled_at, order_items (id, item_name, unit_price_cents, quantity, notes)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Could not load order: ${error.message}`);
  return data;
}
