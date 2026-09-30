import { CartView } from "@/components/diner/CartView";
import { getDinerSession } from "@/lib/diner";
import { getRestaurantCurrency } from "@/lib/diner-orders";
import { TableClosed } from "../TableClosed";
import { placeOrderAction } from "./actions";

export const metadata = { title: "Your order · Salu" };

export default async function CartPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, session] = await Promise.all([params, getDinerSession()]);
  if (session.kind !== "open") return <TableClosed token={token} kind={session.kind} />;
  const currency = await getRestaurantCurrency(session.table.restaurantId);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-semibold">Your order</h1>
        <p className="text-muted">
          {session.table.restaurantName} · Table {session.table.tableLabel}
        </p>
      </header>
      <CartView
        token={token}
        sessionId={session.table.sessionId}
        currency={currency}
        placeOrder={placeOrderAction}
      />
    </main>
  );
}
