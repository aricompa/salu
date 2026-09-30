import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui";
import { OrderStatusView } from "@/components/diner/OrderStatusView";
import { getDinerSession } from "@/lib/diner";
import { getDinerOrder, getRestaurantCurrency } from "@/lib/diner-orders";
import { formatCents } from "@/lib/money";
import { uuidField } from "@/lib/validation/fields";
import { TableClosed } from "../../TableClosed";

export const metadata = { title: "Your order · Salu" };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string; orderId: string }>;
}) {
  const [{ token, orderId }, session] = await Promise.all([params, getDinerSession()]);
  if (session.kind === "none") return <TableClosed token={token} kind="none" />;
  const id = uuidField.safeParse(orderId);
  if (!id.success) notFound();
  const [order, currency] = await Promise.all([
    getDinerOrder(id.data),
    getRestaurantCurrency(session.table.restaurantId),
  ]);
  if (!order) notFound();
  const money = (cents: number) => formatCents(cents, currency);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-4 pb-32">
      <header>
        <h1 className="text-lg text-muted">
          {session.table.restaurantName} · Table {session.table.tableLabel}
        </h1>
      </header>
      {session.kind === "closed" && (
        <p className="rounded-card border border-border p-3">
          This table has been closed. Thanks for dining!
        </p>
      )}
      <OrderStatusView
        orderId={order.id}
        initialStatus={order.status}
        submittedAt={order.submitted_at}
      />
      <section aria-labelledby="order-summary" className="flex flex-col gap-2">
        <h2 id="order-summary" className="text-xl font-semibold">
          Your order
        </h2>
        <ul className="flex flex-col divide-y divide-border">
          {order.order_items.map((line) => (
            <li key={line.id} className="flex justify-between gap-3 py-2">
              <span>
                {line.quantity} × {line.item_name}
                {line.notes && <span className="block text-sm text-muted">“{line.notes}”</span>}
              </span>
              <span>{money(line.unit_price_cents * line.quantity)}</span>
            </li>
          ))}
        </ul>
        {order.notes && <p className="text-muted">Note: {order.notes}</p>}
        <p className="flex justify-between border-t border-border pt-2 text-lg font-semibold">
          <span>Subtotal</span>
          <span>{money(order.subtotal_cents)}</span>
        </p>
      </section>
      {session.kind === "open" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 p-4 backdrop-blur">
          <Link
            href={`/t/${token}/menu`}
            className={buttonStyles("secondary", "mx-auto w-full max-w-2xl")}
          >
            Order more
          </Link>
        </div>
      )}
    </main>
  );
}
