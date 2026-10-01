import type { OrderStatus } from "@/lib/order-status";

/** Order board pure helpers (PRD P4). The data comes from src/lib/orders.ts. */

export type ActiveStatus = Extract<OrderStatus, "submitted" | "accepted" | "preparing" | "ready">;

export const BOARD_COLUMNS: ReadonlyArray<{ status: ActiveStatus; title: string; empty: string }> =
  [
    { status: "submitted", title: "New", empty: "No new orders." },
    { status: "accepted", title: "Accepted", empty: "Nothing accepted yet." },
    { status: "preparing", title: "Preparing", empty: "Nothing on the line." },
    { status: "ready", title: "Ready", empty: "Nothing at the pass." },
  ];

export const ACTIVE_STATUSES: readonly ActiveStatus[] = BOARD_COLUMNS.map((c) => c.status);

/**
 * One primary action per column. The state machine also allows accepted → ready
 * (skipping Preparing); the board keeps a single next step so a tap is never a guess.
 */
export const NEXT_ACTION: Record<ActiveStatus, { to: OrderStatus; label: string }> = {
  submitted: { to: "accepted", label: "Accept" },
  accepted: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
  ready: { to: "served", label: "Mark served" },
};

/** enforce_order_transition allows cancel from submitted, accepted and preparing only. */
export function canCancel(status: OrderStatus): boolean {
  return status === "submitted" || status === "accepted" || status === "preparing";
}

export type AgeTone = "neutral" | "warning" | "danger";

/** Ticket age with text as well as a tone (rule U4): warning at 10 minutes, danger at 20. */
export function ticketAge(
  submittedAt: string,
  now: Date,
): { minutes: number; tone: AgeTone; text: string } {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(submittedAt)) / 60_000));
  if (minutes >= 20) return { minutes, tone: "danger", text: `${minutes} min · Overdue` };
  if (minutes >= 10) return { minutes, tone: "warning", text: `${minutes} min · Long wait` };
  return { minutes, tone: "neutral", text: minutes === 0 ? "Just now" : `${minutes} min` };
}

export type Participant = { user_id: string; display_name: string | null; joined_at: string };

/**
 * Board labels for one table session: the diner's name, or "Guest N" where N is their
 * position by joined_at (PRD D2).
 */
export function dinerLabels(participants: readonly Participant[]): Map<string, string> {
  const ordered = [...participants].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  return new Map(ordered.map((p, i) => [p.user_id, p.display_name ?? `Guest ${i + 1}`]));
}

/**
 * Average minutes from sent to served (the dashboard's "time to serve"), rounded to the
 * minute; null when nothing was served.
 */
export function averageServeMinutes(
  orders: ReadonlyArray<{ submitted_at: string; served_at: string | null }>,
): number | null {
  const spans = orders
    .filter((o) => o.served_at)
    .map((o) => (Date.parse(o.served_at as string) - Date.parse(o.submitted_at)) / 60_000);
  if (spans.length === 0) return null;
  return Math.round(spans.reduce((a, b) => a + b, 0) / spans.length);
}
