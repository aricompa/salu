import type { Database } from "@/lib/db/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

/** Diner-facing copy per status (PRD 5.7 where it has words; the rest in the same voice). */
export const STATUS_COPY: Record<OrderStatus, string> = {
  submitted: "Your order's in. The kitchen has it.",
  accepted: "Accepted. Your food is on its way to being made.",
  preparing: "Preparing. It's being made now.",
  ready: "Ready. It's coming to your table.",
  served: "Served. Enjoy!",
  cancelled: "This order was cancelled. Your server will follow up.",
};

const STEPS = [
  { status: "submitted", label: "Sent" },
  { status: "accepted", label: "Accepted" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "served", label: "Served" },
] as const;

export type TimelineStep = { label: string; state: "done" | "current" | "upcoming" };

/**
 * Sent → Accepted → Preparing → Ready → Served. Staff may skip Preparing (accepted → ready),
 * so every step before the current one counts as done. A cancelled order has no timeline.
 */
export function timelineSteps(status: OrderStatus): TimelineStep[] {
  if (status === "cancelled") return [];
  const at = STEPS.findIndex((s) => s.status === status);
  return STEPS.map((s, i) => ({
    label: s.label,
    state: i < at ? "done" : i === at ? (status === "served" ? "done" : "current") : "upcoming",
  }));
}
