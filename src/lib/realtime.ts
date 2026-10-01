import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";

export type OrderChange = Pick<
  Tables<"orders">,
  "status" | "accepted_at" | "ready_at" | "served_at" | "cancelled_at"
>;

type LiveHandlers = {
  /** The change feed is ready (first subscribe and every reconnect): refetch now. */
  onLive: () => void;
  onInterrupted: () => void;
};

/**
 * One Postgres Changes subscription on public.orders (rule A5). RLS decides which rows
 * this user may receive. onLive fires each time the change feed is ready (first subscribe
 * and every reconnect), so the caller refetches then: that covers reconnects and anything
 * that changed between render and the feed going live. Returns the unsubscribe function.
 */
function subscribeToOrders(
  channelName: string,
  change: { events: ReadonlyArray<"INSERT" | "UPDATE">; filter: string },
  onPayload: (row: Record<string, unknown>) => void,
  handlers: LiveHandlers,
): () => void {
  const supabase = createClient();
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let stopped = false;

  // The browser client reads the session from cookies asynchronously. Without this, the
  // channel can join before the user's JWT is attached: Realtime then treats them as
  // anonymous, RLS finds no readable orders, and no change ever arrives.
  void supabase.realtime.setAuth().then(() => {
    if (stopped) return;
    channel = supabase.channel(channelName);
    for (const event of change.events) {
      channel = channel.on(
        "postgres_changes",
        { event, schema: "public", table: "orders", filter: change.filter },
        (payload) => onPayload(payload.new as Record<string, unknown>),
      );
    }
    channel = channel
      // The join reply ("SUBSCRIBED") comes before the database change feed is ready; a
      // change in between would be missed. Realtime says when the feed is really live.
      .on("system", {}, (payload: { extension?: string; status?: string }) => {
        if (payload.extension !== "postgres_changes") return;
        if (payload.status === "ok") handlers.onLive();
        else handlers.onInterrupted();
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") handlers.onInterrupted();
      });
  });

  return () => {
    stopped = true;
    if (channel) void supabase.removeChannel(channel);
  };
}

/** Live status for one order, filtered by id (the diner's status page). Call the result on unmount. */
export function subscribeToOrder(
  orderId: string,
  handlers: LiveHandlers & { onChange: (change: OrderChange) => void },
): () => void {
  return subscribeToOrders(
    `order-${orderId}`,
    { events: ["UPDATE"], filter: `id=eq.${orderId}` },
    (row) => handlers.onChange(row as OrderChange),
    handlers,
  );
}

/**
 * Every order change for one restaurant (the staff board), filtered by restaurant_id.
 * A payload is never the whole picture (order_items isn't published, and place_order
 * inserts, then updates the subtotal), so the board only learns "something changed" and
 * re-renders from the server. Call the result on unmount.
 */
export function subscribeToRestaurantOrders(
  restaurantId: string,
  handlers: LiveHandlers & { onChange: () => void },
): () => void {
  return subscribeToOrders(
    `orders-${restaurantId}`,
    // Not "*": DELETE events can't be filtered or RLS-checked (rule 5 forbids deletes anyway).
    { events: ["INSERT", "UPDATE"], filter: `restaurant_id=eq.${restaurantId}` },
    () => handlers.onChange(),
    handlers,
  );
}
