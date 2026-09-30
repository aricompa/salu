import { createClient } from "@/lib/supabase/client";
import type { OrderStatus } from "@/lib/order-status";

export type OrderChange = {
  status: OrderStatus;
  accepted_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  cancelled_at: string | null;
};

/**
 * Live status for one order (rule A5): Postgres Changes on public.orders filtered by id.
 * RLS decides what this diner may receive. onLive fires on every (re)subscribe, so the
 * caller refetches then: that covers reconnects and the gap between render and subscribe.
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") handlers.onLive();
        else handlers.onInterrupted();
      });
  });

  return () => {
    stopped = true;
    if (channel) void supabase.removeChannel(channel);
  };
}
