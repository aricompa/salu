"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { STATUS_COPY, timelineSteps, type OrderStatus } from "@/lib/order-status";

/** Time in the device's zone (rule A7); the server can't know it, so the browser formats. */
function LocalTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
        new Date(iso),
      )}
    </time>
  );
}

/** Live order status: headline copy, the timeline, and a connection line (PRD D6, Phase 1). */
export function OrderStatusView({
  orderId,
  initialStatus,
  submittedAt,
}: {
  orderId: string;
  initialStatus: OrderStatus;
  submittedAt: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting">(
    "connecting",
  );
  const refresh = useRef(router.refresh);

  // A server refresh (after reconnecting) brings a newer status down as a prop.
  const [seenInitial, setSeenInitial] = useState(initialStatus);
  if (initialStatus !== seenInitial) {
    setSeenInitial(initialStatus);
    setStatus(initialStatus);
  }

  useEffect(() => {
    refresh.current = router.refresh;
  }, [router]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let stopped = false;
    // Loaded after first paint: the realtime client (supabase-js) is 66 KB gzip.
    void import("@/lib/realtime").then(({ subscribeToOrder }) => {
      if (stopped) return;
      unsubscribe = subscribeToOrder(orderId, {
        onChange: (change) => setStatus(change.status),
        onLive: () => {
          setConnection("live");
          refresh.current();
        },
        onInterrupted: () => setConnection("reconnecting"),
      });
    });
    return () => {
      stopped = true;
      unsubscribe?.();
    };
  }, [orderId]);

  const steps = timelineSteps(status);
  return (
    <section aria-labelledby="order-status" className="flex flex-col gap-4">
      <div role="status" className="flex flex-col gap-1">
        <h2 id="order-status" className="text-2xl font-semibold">
          {STATUS_COPY[status]}
        </h2>
        <p className="text-muted">
          Sent at <LocalTime iso={submittedAt} />
        </p>
      </div>
      {steps.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label="Order progress">
          {steps.map((step) => (
            <li
              key={step.label}
              aria-current={step.state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-card border px-3 py-2",
                step.state === "current" ? "border-text font-semibold" : "border-border",
                step.state === "upcoming" && "text-muted",
              )}
            >
              <span aria-hidden="true" className="w-5 text-center">
                {step.state === "done" ? "✓" : step.state === "current" ? "●" : "○"}
              </span>
              <span>{step.label}</span>
              <span className="ml-auto text-sm">
                {step.state === "done" ? "Done" : step.state === "current" ? "Now" : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm text-muted">
        {connection === "live"
          ? "Live: this page updates on its own."
          : connection === "reconnecting"
            ? "Reconnecting… pull to refresh if this stays."
            : "Connecting…"}
      </p>
    </section>
  );
}
