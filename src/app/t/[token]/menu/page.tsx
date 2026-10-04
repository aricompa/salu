import Link from "next/link";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { MenuView } from "@/components/diner/MenuView";
import { NameSheet } from "@/components/diner/NameSheet";
import { getDinerSession, hasDisplayName } from "@/lib/diner";
import { getDinerMenu } from "@/lib/diner-menu";
import { getActiveOrderId } from "@/lib/diner-orders";
import { TableClosed } from "../TableClosed";
import { saveDisplayNameAction } from "./actions";
import { DinerHeader } from "@/components/diner/DinerHeader";

export const metadata = { title: "Menu · Salu" };

export default async function MenuPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, session] = await Promise.all([params, getDinerSession()]);
  if (session.kind !== "open") return <TableClosed token={token} kind={session.kind} />;
  const { table } = session;
  const [menu, activeOrderId, named] = await Promise.all([
    getDinerMenu(table.restaurantId),
    getActiveOrderId(table.sessionId),
    hasDisplayName(table.sessionId),
  ]);

  return (
    <>
      <OfflineBanner message="You're offline. Your cart is saved; ordering waits for the connection." />
      <main className="mx-auto flex max-w-2xl flex-col px-4 pt-4">
        <DinerHeader className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-[0.02em] uppercase">
              {table.restaurantName}
            </h1>
            <p className="text-muted">Table {table.tableLabel}</p>
          </div>
          {activeOrderId && (
            <Link
              href={`/t/${token}/orders/${activeOrderId}`}
              className="inline-flex min-h-11 items-center rounded-chip border border-text px-4 font-medium"
            >
              Orders
            </Link>
          )}
        </DinerHeader>
        {menu.categories.length === 0 ? (
          <p className="py-16 text-center text-lg text-muted">
            The menu isn&apos;t ready yet. Ask your server.
          </p>
        ) : (
          <MenuView
            token={token}
            sessionId={table.sessionId}
            currency={menu.currency}
            categories={menu.categories}
          />
        )}
      </main>
      {!named && <NameSheet sessionId={table.sessionId} save={saveDisplayNameAction} />}
    </>
  );
}
