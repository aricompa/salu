import "server-only";
import { fail, toAppError, type ActionResult, type AppErrorCode } from "@/lib/errors";

type DbError = { code?: string | null; hint?: string | null; message?: string | null };
type RowsResult = { data: unknown[] | null; error: DbError | null };

/**
 * Checks an update or delete that ended in `.select("id")`. RLS does not raise on a
 * row it filters out: a floor-staff update simply changes 0 rows. So 0 rows means
 * "not allowed" (or already gone), never success.
 */
export function oneRowChanged(
  result: RowsResult,
  options: { unique?: AppErrorCode } = {},
): ActionResult<null> {
  if (result.error) return { ok: false, error: toAppError(result.error, options) };
  if (!result.data || result.data.length === 0) return fail("not_allowed");
  return { ok: true, data: null };
}

/**
 * Swaps an entry with its neighbour and writes back 0..n sort orders for the rows
 * that moved. Rows seeded with equal sort orders get renumbered the first time.
 */
export async function reorder(
  rows: ReadonlyArray<{ id: string; sort_order: number }>,
  id: string,
  direction: "up" | "down",
  write: (id: string, sortOrder: number) => Promise<ActionResult<null>>,
): Promise<ActionResult<null>> {
  const from = rows.findIndex((r) => r.id === id);
  if (from === -1) return fail("not_found");
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= rows.length) return { ok: true, data: null };

  const ordered = [...rows];
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  for (const [index, row] of ordered.entries()) {
    if (row.sort_order === index) continue;
    const result = await write(row.id, index);
    if (!result.ok) return result;
  }
  return { ok: true, data: null };
}
