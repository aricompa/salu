import { ActionButton, ConfirmDialog } from "@/components/ui";
import type { SeatingTable } from "@/lib/table-sessions";
import { closeTableAction, seatTableAction } from "./actions";

const openOrders = (n: number) =>
  n === 0 ? "No open orders" : `${n} open order${n === 1 ? "" : "s"}`;

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
                  <ConfirmDialog
                    triggerLabel="Close table"
                    triggerContext={table.label}
                    title={
                      count > 0
                        ? `${table.label} still has ${openOrders(count).toLowerCase()}. Close anyway?`
                        : `Close ${table.label}?`
                    }
                    body={
                      count > 0
                        ? "Its orders stay on the board. Diners can't add to this tab."
                        : "The next party starts a new tab."
                    }
                    confirmLabel="Close table"
                    dismissLabel="Keep open"
                    action={closeTableAction}
                    fields={{ sessionId: table.sessionId }}
                  />
                ) : (
                  <ActionButton
                    action={seatTableAction}
                    fields={{ id: table.id }}
                    variant="primary"
                  >
                    Seat <span className="sr-only">{table.label}</span>
                  </ActionButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
