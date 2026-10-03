import "server-only";
import {
  ACTIVE_STATUSES,
  boardLines,
  dinerLabels,
  type BoardLine,
  type Participant,
} from "@/lib/board";
import type { ActionResult } from "@/lib/errors";
import { oneRowChanged } from "@/lib/mutations";
import type { OrderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/server";

export type BoardOrder = {
  id: string;
  sessionId: string;
  status: OrderStatus;
  tableLabel: string;
  dinerLabel: string;
  notes: string | null;
  submittedAt: string;
  /** served_at or cancelled_at; null while the order is active. */
  finishedAt: string | null;
  items: BoardLine[];
};

const ORDER_COLUMNS =
  "id, session_id, placed_by, status, notes, submitted_at, served_at, cancelled_at, order_items (id, parent_id, item_name, quantity, notes), table_sessions (dining_tables (label))";

/**
 * The live board through RLS (members only): every active order, oldest first, and the
 * orders served or cancelled since `dayStart` (the restaurant's midnight, rule A7).
 * Diner labels come from a second query: orders.placed_by has no foreign key to
 * session_participants, so PostgREST can't embed them.
 */
export async function getBoardOrders(
  restaurantId: string,
  dayStart: Date,
): Promise<{ active: BoardOrder[]; done: BoardOrder[] }> {
  const supabase = await createClient();
  const since = `"${dayStart.toISOString()}"`;
  const [active, done] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("restaurant_id", restaurantId)
      .in("status", [...ACTIVE_STATUSES])
      .order("submitted_at", { ascending: true })
      .limit(300),
    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("restaurant_id", restaurantId)
      .in("status", ["served", "cancelled"])
      .or(`served_at.gte.${since},cancelled_at.gte.${since}`)
      .order("submitted_at", { ascending: false })
      .limit(200),
  ]);
  if (active.error) throw new Error(`Could not load orders: ${active.error.message}`);
  if (done.error) throw new Error(`Could not load finished orders: ${done.error.message}`);

  const sessionIds = [...new Set([...active.data, ...done.data].map((o) => o.session_id))];
  const labels = new Map<string, Map<string, string>>();
  if (sessionIds.length > 0) {
    const { data, error } = await supabase
      .from("session_participants")
      .select("session_id, user_id, display_name, joined_at")
      .in("session_id", sessionIds);
    if (error) throw new Error(`Could not load diners: ${error.message}`);
    const bySession = new Map<string, Participant[]>();
    for (const p of data) bySession.set(p.session_id, [...(bySession.get(p.session_id) ?? []), p]);
    for (const [id, people] of bySession) labels.set(id, dinerLabels(people));
  }

  const toBoard = (o: (typeof active.data)[number]): BoardOrder => ({
    id: o.id,
    sessionId: o.session_id,
    status: o.status,
    tableLabel: o.table_sessions?.dining_tables?.label ?? "Table",
    dinerLabel: (o.placed_by && labels.get(o.session_id)?.get(o.placed_by)) || "Guest",
    notes: o.notes,
    submittedAt: o.submitted_at,
    finishedAt: o.served_at ?? o.cancelled_at,
    items: boardLines(o.order_items),
  });
  return { active: active.data.map(toBoard), done: done.data.map(toBoard) };
}

/**
 * Moves an order along or cancels it: `status` only (rule 5). The database trigger
 * enforces the state machine and raises `invalid_transition` for a stale move; the row
 * is read back, so an update RLS filtered out is `not_allowed`, never success.
 */
export async function setOrderStatus(
  restaurantId: string,
  orderId: string,
  status: Exclude<OrderStatus, "submitted">,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  return oneRowChanged(
    await supabase
      .from("orders")
      .update({ status })
      .eq("restaurant_id", restaurantId)
      .eq("id", orderId)
      .select("id, status"),
  );
}
