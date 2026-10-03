/**
 * Order lines as the kitchen and the diner read them: each add-on under the line it
 * belongs to (order_items.parent_id, ruled 2026-10-03). Pure, shared by the board and the
 * diner's order page.
 */
export type NestedLine<T> = T & { addons: T[] };

export function nestLines<T extends { id: string; parent_id: string | null }>(
  rows: T[],
): Array<NestedLine<T>> {
  const lines = new Map<string, NestedLine<T>>();
  for (const row of rows) if (row.parent_id === null) lines.set(row.id, { ...row, addons: [] });
  for (const row of rows) {
    if (row.parent_id === null) continue;
    const parent = lines.get(row.parent_id);
    // The schema keeps a parent in the same order; a missing one still shows the line.
    if (parent) parent.addons.push(row);
    else lines.set(row.id, { ...row, addons: [] });
  }
  return [...lines.values()];
}
