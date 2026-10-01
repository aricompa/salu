import { requireMembership } from "@/lib/auth";
import { getBoardOrders } from "@/lib/orders";
import { getSeatingTables } from "@/lib/table-sessions";
import { startOfDayIn } from "@/lib/time";
import { BoardLive } from "./BoardLive";
import { OrderBoard } from "./OrderBoard";
import { TablesStrip } from "./TablesStrip";

export const metadata = { title: "Orders · Salu" };

/** The live order board (PRD P4). Every member uses it, floor staff included. */
export default async function OrdersPage() {
  const { membership } = await requireMembership();
  const timeZone = membership.restaurantTimezone;
  const [{ active, done }, tables] = await Promise.all([
    getBoardOrders(membership.restaurantId, startOfDayIn(timeZone, new Date())),
    getSeatingTables(membership.restaurantId),
  ]);
  const openOrdersBySession = new Map<string, number>();
  for (const order of active)
    openOrdersBySession.set(order.sessionId, (openOrdersBySession.get(order.sessionId) ?? 0) + 1);

  return (
    <BoardLive
      restaurantId={membership.restaurantId}
      orders={active.map((o) => ({ id: o.id, status: o.status, tableLabel: o.tableLabel }))}
    >
      <div className="flex flex-col gap-6">
        <TablesStrip tables={tables} openOrdersBySession={openOrdersBySession} />
        <OrderBoard active={active} done={done} timeZone={timeZone} />
      </div>
    </BoardLive>
  );
}
