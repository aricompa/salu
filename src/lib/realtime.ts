import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/db/types";

export type OrderChange = Pick<
  Tables<"orders">,
  "status" | "accepted_at" | "ready_at" | "served_at" | "cancelled_at"
>;

/**
 * Live status for one order (rule A5): Postgres Changes on public.orders filtered by id.
 * RLS decides what this diner may receive. onLive fires each time the change feed is ready
 * (first subscribe and every reconnect), so the caller refetches then: that covers
 * reconnects and anything that changed between render and the feed going live.
 * Returns the unsubscribe function; call it on unmount.
 */
export function subscribeToOrder(
  orderId: string,
  handlers: {
    onChange: (change: OrderChange) => void;
    onLive: () => void;
    onInterrupted: () => void;
  },
): () => void {
  const supabase = createClient();
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let stopped = false;

  // The browser client reads the session from cookies asynchronously. Without this, the
  // channel can join before the diner's JWT is attached: Realtime then treats the diner as
  // anonymous, RLS finds no readable orders, and no change ever arrives.
  void supabase.realtime.setAuth().then(() => {
    if (stopped) return;
    channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => handlers.onChange(payload.new as OrderChange),
      )
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
