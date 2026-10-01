"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { Button, cn } from "@/components/ui";
import type { OrderStatus } from "@/lib/order-status";
import { subscribeToRestaurantOrders } from "@/lib/realtime";
import {
  chime,
  getServerSound,
  getSound,
  subscribeSound,
  turnSoundOff,
  turnSoundOn,
} from "./sound";

export type LiveOrder = { id: string; status: OrderStatus; tableLabel: string };

const FreshOrders = createContext<ReadonlySet<string>>(new Set());

/** True for an order that arrived while this board was open (it pulses once). */
export function useFreshOrder(id: string): boolean {
  return useContext(FreshOrders).has(id);
}

type Connection = "connecting" | "live" | "reconnecting";

function announce(arrivals: LiveOrder[]): string {
  if (arrivals.length === 1) return `New order for ${arrivals[0].tableLabel}.`;
  return `${arrivals.length} new orders: ${arrivals.map((o) => o.tableLabel).join(", ")}.`;
}

/**
 * Keeps the server-rendered board live. Realtime is only a trigger: any order change for
 * this restaurant asks the server to re-render (one refresh in flight, one trailing). New
 * orders are found by comparing ids between renders, never from event payloads, so orders
 * that arrived during a disconnect still alert once the board catches up.
 */
export function BoardLive({
  restaurantId,
  orders,
  children,
}: {
  restaurantId: string;
  orders: LiveOrder[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [connection, setConnection] = useState<Connection>("connecting");

  // Coalesced refresh: every request bumps `requested`; a refresh covers all requests so
  // far, and requests that arrive while one is in flight get exactly one more.
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

  // Orders present on first render never alert; later arrivals still waiting to be
  // accepted do. One a colleague already accepted elsewhere needs no alert.
  const [tracked, setTracked] = useState(() => ({
    orders,
    seen: new Set(orders.map((o) => o.id)) as ReadonlySet<string>,
    fresh: new Set<string>() as ReadonlySet<string>,
    alerts: 0,
    announcement: "",
  }));
  if (tracked.orders !== orders) {
    const arrivals = orders.filter((o) => o.status === "submitted" && !tracked.seen.has(o.id));
    setTracked({
      orders,
      seen: new Set([...tracked.seen, ...orders.map((o) => o.id)]),
      fresh: arrivals.length
        ? new Set([...tracked.fresh, ...arrivals.map((o) => o.id)])
        : tracked.fresh,
      alerts: tracked.alerts + (arrivals.length ? 1 : 0),
      announcement: arrivals.length ? announce(arrivals) : tracked.announcement,
    });
  }

  // Sound needs one tap (browser autoplay rules). After a reload the choice is remembered
  // but the browser still wants a gesture, so the toggle says so rather than claim it's on.
  const sound = useSyncExternalStore(subscribeSound, getSound, getServerSound);
  useEffect(() => {
    if (tracked.alerts > 0) chime();
  }, [tracked.alerts]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Orders</h1>
        <div className="flex flex-wrap items-center gap-4">
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
          {sound === "unsupported" ? (
            <p className="text-muted">Sound isn&apos;t available in this browser.</p>
          ) : sound === "on" ? (
            <Button variant="secondary" onClick={turnSoundOff}>
              Turn off sound
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => void turnSoundOn()}>
              {sound === "blocked" ? "Tap to turn sound back on" : "Turn on sound"}
            </Button>
          )}
        </div>
      </div>
      {/* The region stays mounted; each alert replaces its content, so it's announced. */}
      <div role="status" aria-live="polite" className="sr-only">
        {tracked.announcement && <span key={tracked.alerts}>{tracked.announcement}</span>}
      </div>
      <FreshOrders.Provider value={tracked.fresh}>{children}</FreshOrders.Provider>
    </div>
  );
}
