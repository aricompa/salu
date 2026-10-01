"use client";

import { ActionButton, ConfirmDialog, useToast } from "@/components/ui";
import { openOrders } from "@/lib/board";
import { closeTableAction, seatTableAction, setOrderStatusAction } from "./actions";

type Step = "accepted" | "preparing" | "ready" | "served";

const DONE: Record<Step, (table: string) => string> = {
  accepted: (t) => `Accepted ${t}'s order.`,
  preparing: (t) => `Started ${t}'s order.`,
  ready: (t) => `${t}'s order is ready for pickup.`,
  served: (t) => `Served ${t}'s order.`,
};

/** A card's next step, with a toast once it's done (the card itself moves away). */
export function OrderStepButton({
  orderId,
  to,
  label,
  tableLabel,
  who,
}: {
  orderId: string;
  to: Step;
  label: string;
  tableLabel: string;
  who: string;
}) {
  const toast = useToast();
  return (
    <ActionButton
      action={setOrderStatusAction}
      fields={{ id: orderId, to }}
      variant="primary"
      onSuccess={() => toast(DONE[to](tableLabel))}
    >
      {label} <span className="sr-only">{who}</span>
    </ActionButton>
  );
}

export function CancelOrderButton({
  orderId,
  tableLabel,
  who,
}: {
  orderId: string;
  tableLabel: string;
  who: string;
}) {
  const toast = useToast();
  return (
    <ConfirmDialog
      triggerLabel="Cancel"
      triggerContext={who}
      triggerVariant="ghost"
      title={`Cancel ${tableLabel}'s order?`}
      body="The diner sees it was cancelled."
      confirmLabel="Cancel order"
      dismissLabel="Keep order"
      action={setOrderStatusAction}
      fields={{ id: orderId, to: "cancelled" }}
      onDone={() => toast(`Cancelled ${tableLabel}'s order.`, "neutral")}
    />
  );
}

export function SeatButton({ tableId, label }: { tableId: string; label: string }) {
  const toast = useToast();
  return (
    <ActionButton
      action={seatTableAction}
      fields={{ id: tableId }}
      variant="primary"
      onSuccess={() => toast(`Seated ${label}. Its code takes orders now.`)}
    >
      Seat <span className="sr-only">{label}</span>
    </ActionButton>
  );
}

export function CloseTableButton({
  sessionId,
  label,
  openOrderCount,
}: {
  sessionId: string;
  label: string;
  openOrderCount: number;
}) {
  const toast = useToast();
  return (
    <ConfirmDialog
      triggerLabel="Close table"
      triggerContext={label}
      title={
        openOrderCount > 0
          ? `${label} still has ${openOrders(openOrderCount).toLowerCase()}. Close anyway?`
          : `Close ${label}?`
      }
      body={
        openOrderCount > 0
          ? "Its orders stay on the board. Diners can't add to this tab."
          : "The next party starts a new tab."
      }
      confirmLabel="Close table"
      dismissLabel="Keep open"
      action={closeTableAction}
      fields={{ sessionId }}
      onDone={() => toast(`Closed ${label}.`, "neutral")}
    />
  );
}
