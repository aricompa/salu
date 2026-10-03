import { Badge, cn } from "@/components/ui";
import { BOARD_COLUMNS, NEXT_ACTION, canCancel, type ActiveStatus } from "@/lib/board";
import type { BoardOrder } from "@/lib/orders";
import { formatTimeIn } from "@/lib/time";
import { CancelOrderButton, OrderStepButton } from "./BoardActions";
import { OrderAge } from "./OrderAge";
import { OrderCardFrame } from "./OrderCardFrame";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Each stage has a brand accent: a filled column heading and a matching card stripe. */
const STAGE_COLOURS: Record<ActiveStatus, { heading: string; stripe: string }> = {
  submitted: { heading: "bg-accent-1", stripe: "border-l-accent-1" },
  accepted: { heading: "bg-accent-2", stripe: "border-l-accent-2" },
  preparing: { heading: "bg-accent-4", stripe: "border-l-accent-4" },
  ready: { heading: "bg-accent-3", stripe: "border-l-accent-3" },
};

function Note({ label, text }: { label: string; text: string }) {
  return (
    <p className="rounded-card border border-warning px-2 py-1 text-warning">
      <span className="font-semibold">{label}:</span> {text}
    </p>
  );
}

function OrderCard({ order }: { order: BoardOrder }) {
  const titleId = `order-${order.id}`;
  const status = order.status as ActiveStatus;
  const next = NEXT_ACTION[status];
  const who = `${order.tableLabel}, ${order.dinerLabel}`;
  return (
    <OrderCardFrame
      id={order.id}
      labelledBy={titleId}
      waiting={status === "submitted"}
      stripe={STAGE_COLOURS[status].stripe}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={titleId} className="text-3xl leading-tight font-bold">
            {order.tableLabel}
          </h3>
          <p className="text-muted">{order.dinerLabel}</p>
        </div>
        <OrderAge submittedAt={order.submittedAt} />
      </div>
      <ul className="flex flex-col gap-2" aria-label="Items">
        {order.items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1">
            <span>
              <span className="font-semibold">{item.quantity} ×</span> {item.name}
            </span>
            {item.addons.length > 0 && (
              <ul className="flex flex-col pl-7" aria-label={`Add-ons for ${item.name}`}>
                {item.addons.map((addon) => (
                  <li key={addon.id}>+ {addon.name}</li>
                ))}
              </ul>
            )}
            {item.notes && <Note label="Note" text={item.notes} />}
          </li>
        ))}
      </ul>
      {order.notes && <Note label="Order note" text={order.notes} />}
      <div className="flex flex-wrap items-start gap-2">
        <OrderStepButton
          orderId={order.id}
          to={next.to}
          label={next.label}
          tableLabel={order.tableLabel}
          who={who}
        />
        {canCancel(status) && (
          <CancelOrderButton orderId={order.id} tableLabel={order.tableLabel} who={who} />
        )}
      </div>
    </OrderCardFrame>
  );
}

function DoneToday({ orders, timeZone }: { orders: BoardOrder[]; timeZone: string }) {
  return (
    <details className="rounded-card border border-border">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-xl font-semibold">
        Done today · {orders.length}
      </summary>
      {orders.length === 0 ? (
        <p className="px-4 pb-4 text-muted">Served and cancelled orders show here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border px-4 pb-2">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="text-xl font-semibold">{order.tableLabel}</span>
              <span className="text-muted">{order.dinerLabel}</span>
              <span>
                {plural(
                  order.items.reduce((n, i) => n + i.quantity, 0),
                  "item",
                )}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <Badge tone={order.status === "served" ? "success" : "danger"}>
                  {order.status === "served" ? "Served" : "Cancelled"}
                </Badge>
                {order.finishedAt && (
                  <time dateTime={order.finishedAt} className="text-muted">
                    {formatTimeIn(timeZone, new Date(order.finishedAt))}
                  </time>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** The order board by status (PRD P4). Renders on the server; BoardLive keeps it fresh. */
export function OrderBoard({
  active,
  done,
  timeZone,
}: {
  active: BoardOrder[];
  done: BoardOrder[];
  timeZone: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        {BOARD_COLUMNS.map((column) => {
          const orders = active.filter((o) => o.status === column.status);
          const headingId = `column-${column.status}`;
          return (
            <section
              key={column.status}
              aria-labelledby={headingId}
              className="flex flex-col gap-3"
            >
              <h2
                id={headingId}
                className={cn(
                  "flex w-fit items-baseline gap-2 rounded-chip px-3.5 py-1 text-xl font-semibold text-on-accent",
                  STAGE_COLOURS[column.status].heading,
                )}
              >
                {column.title} <span className="font-normal">{orders.length}</span>
              </h2>
              {orders.length === 0 ? (
                <p className="rounded-card border border-dashed border-border p-4 text-muted">
                  {column.empty}
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {orders.map((order) => (
                    <li key={order.id}>
                      <OrderCard order={order} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
      <DoneToday orders={done} timeZone={timeZone} />
    </div>
  );
}
