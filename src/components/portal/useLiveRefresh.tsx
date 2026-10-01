"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/components/ui";
import { subscribeToRestaurantOrders } from "@/lib/realtime";

export type Connection = "connecting" | "live" | "reconnecting";

/**
 * Keeps a server-rendered portal page live. Realtime is only a trigger: any order change
 * for this restaurant asks the server to re-render, coalesced to one refresh in flight
 * plus one trailing. Each time the change feed is ready (first join and every reconnect)
 * it refreshes too, which covers anything missed while away.
 */
export function useLiveRefresh(restaurantId: string): Connection {
  const router = useRouter();
  const [connection, setConnection] = useState<Connection>("connecting");

  const [refreshing, startRefresh] = useTransition();
  const [requested, setRequested] = useState(0);
  const handled = useRef(0);
  const requestRefresh = useCallback(() => setRequested((n) => n + 1), []);
  useEffect(() => {
    if (refreshing || handled.current === requested) return;
    handled.current = requested;
    startRefresh(() => router.refresh());
  }, [requested, refreshing, router]);

  useEffect(
    () =>
      subscribeToRestaurantOrders(restaurantId, {
        onChange: requestRefresh,
        onLive: () => {
          setConnection("live");
          requestRefresh();
        },
        onInterrupted: () => setConnection("reconnecting"),
      }),
    [restaurantId, requestRefresh],
  );

  return connection;
}

/** "Live" / "Reconnecting…" with text, not colour alone (rule U4). */
export function LiveStatus({ connection }: { connection: Connection }) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-center gap-2 font-medium",
        connection === "live" ? "text-success" : "text-warning",
      )}
    >
      <span aria-hidden="true">{connection === "live" ? "●" : "○"}</span>
      {connection === "live"
        ? "Live"
        : connection === "reconnecting"
          ? "Reconnecting…"
          : "Connecting…"}
    </p>
  );
}

/** For a Server Component page: the live indicator, and the refreshes behind it. */
export function LiveRefresh({ restaurantId }: { restaurantId: string }) {
  return <LiveStatus connection={useLiveRefresh(restaurantId)} />;
}
