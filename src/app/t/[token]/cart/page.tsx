import { CartView } from "@/components/diner/CartView";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { getDinerSession } from "@/lib/diner";
import { getRestaurantCurrency } from "@/lib/diner-orders";
import { TableClosed } from "../TableClosed";
import { placeOrderAction } from "./actions";
import { DinerHeader } from "@/components/diner/DinerHeader";

export const metadata = { title: "Your order · Salu" };

export default async function CartPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, session] = await Promise.all([params, getDinerSession()]);
  if (session.kind !== "open") return <TableClosed token={token} kind={session.kind} />;
  const currency = await getRestaurantCurrency(session.table.restaurantId);
  return (
    <>
      <OfflineBanner message="You're offline. Your cart is saved; reconnect to place your order." />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-4">
        <DinerHeader>
          <h1 className="text-2xl font-extrabold tracking-[0.02em] uppercase">Your order</h1>
          <p className="text-muted">
            {session.table.restaurantName} · Table {session.table.tableLabel}
          </p>
        </DinerHeader>
        <CartView
          token={token}
          sessionId={session.table.sessionId}
          currency={currency}
          placeOrder={placeOrderAction}
        />
      </main>
    </>
  );
}
