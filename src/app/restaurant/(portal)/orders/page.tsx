import { requireMembership } from "@/lib/auth";
import { getBoardOrders } from "@/lib/orders";
import { startOfDayIn } from "@/lib/time";
import { BoardLive } from "./BoardLive";
import { OrderBoard } from "./OrderBoard";

export const metadata = { title: "Orders · Salu" };

/** The live order board (PRD P4). Every member uses it, floor staff included. */
export default async function OrdersPage() {
  const { membership } = await requireMembership();
  const timeZone = membership.restaurantTimezone;
  const { active, done } = await getBoardOrders(
    membership.restaurantId,
    startOfDayIn(timeZone, new Date()),
  );

  return (
    <BoardLive
      restaurantId={membership.restaurantId}
      orders={active.map((o) => ({ id: o.id, status: o.status, tableLabel: o.tableLabel }))}
    >
      <OrderBoard active={active} done={done} timeZone={timeZone} />
    </BoardLive>
  );
}
