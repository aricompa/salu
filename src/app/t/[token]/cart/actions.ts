"use server";

import { getDinerSession } from "@/lib/diner";
import { placeOrder, unavailableAmong } from "@/lib/diner-orders";
import { fail, type AppError } from "@/lib/errors";
import { orderSchema } from "@/lib/validation/diner";

export type PlaceOrderResult =
  | { ok: true; data: { orderId: string } }
  | { ok: false; error: AppError; soldOutItemIds?: string[] };

/**
 * Places the cart as an order for the table this device scanned. Uses the session id from
 * the scan, so a table closed by staff answers session_closed instead of opening a new tab.
 * Sends item ids, quantities and notes only; the database prices everything (rule 4).
 */
export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const session = await getDinerSession();
  if (session.kind === "closed") return fail("session_closed");
  if (session.kind === "none") return fail("not_participant");
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_items");

  const result = await placeOrder(session.table.sessionId, parsed.data);
  if (result.ok || result.error.code !== "item_unavailable") return result;
  const soldOutItemIds = await unavailableAmong(session.table.restaurantId, [
    ...new Set(parsed.data.lines.map((l) => l.itemId)),
  ]);
  return { ...result, soldOutItemIds };
}
