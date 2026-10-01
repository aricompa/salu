import { openOrders } from "@/lib/board";
import type { SeatingTable } from "@/lib/table-sessions";
import { CloseTableButton, SeatButton } from "./BoardActions";

/**
 * Seat and close tables from the board (prank protection, ruled 2026-09-30): a table's
 * code takes orders only once someone here taps Seat. Any member may do either.
 */
export function TablesStrip({
  tables,
  openOrdersBySession,
}: {
  tables: SeatingTable[];
  openOrdersBySession: ReadonlyMap<string, number>;
}) {
  return (
    <section aria-labelledby="tables-strip" className="flex flex-col gap-3">
      <h2 id="tables-strip" className="text-xl font-semibold">
        Tables
      </h2>
      {tables.length === 0 ? (
        <p className="text-muted">No active tables. Add them on the Tables page.</p>
      ) : (
        // relative: the buttons' screen-reader labels are absolutely positioned, and must
        // be clipped by this scroller, not widen the page.
        <ul className="relative flex gap-3 overflow-x-auto pb-2">
          {tables.map((table) => {
            const count = table.sessionId ? (openOrdersBySession.get(table.sessionId) ?? 0) : 0;
            return (
              <li
                key={table.id}
                className="flex min-w-44 shrink-0 flex-col gap-2 rounded-card border border-border bg-surface-raised p-3"
              >
                <p className="text-2xl font-bold">{table.label}</p>
                <p className={table.sessionId ? "text-text" : "text-muted"}>
                  {table.sessionId ? `Seated · ${openOrders(count)}` : "Not seated"}
                </p>
                {table.sessionId ? (
                  <CloseTableButton
                    sessionId={table.sessionId}
                    label={table.label}
                    openOrderCount={count}
                  />
                ) : (
                  <SeatButton tableId={table.id} label={table.label} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
