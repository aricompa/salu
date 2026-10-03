/**
 * Linked add-ons on the diner menu (ruled 2026-10-03), by the same rules place_order
 * enforces: an add-on is offered when it is add-on-only, in an active category and linked
 * to the item; it hangs off an item that is not add-on-only; and add-on-only items never
 * show as menu items of their own. Pure, so the rules are unit-tested.
 */
export type AddonLink = { item_id: string; addon_id: string };

type MenuRow = { id: string; category_id: string | null; addon_only: boolean };

export function shapeDinerMenu<C extends { id: string }, I extends MenuRow>(
  categories: C[],
  items: I[],
  links: AddonLink[],
): Array<C & { items: Array<I & { addons: I[] }> }> {
  const active = new Set(categories.map((c) => c.id));
  const inActive = (i: I) => i.category_id !== null && active.has(i.category_id);
  // Keep the menu's order (sort_order, then created_at), not the order links were made.
  const position = new Map(items.map((item, index) => [item.id, index]));
  const offered = new Map(items.filter((i) => i.addon_only && inActive(i)).map((i) => [i.id, i]));
  const addonsOf = new Map<string, I[]>();
  for (const link of links) {
    const addon = offered.get(link.addon_id);
    if (!addon) continue;
    addonsOf.set(link.item_id, [...(addonsOf.get(link.item_id) ?? []), addon]);
  }
  for (const list of addonsOf.values()) {
    list.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
  }

  return categories
    .map((c) => ({
      ...c,
      items: items
        .filter((i) => i.category_id === c.id && !i.addon_only)
        .map((i) => ({ ...i, addons: addonsOf.get(i.id) ?? [] })),
    }))
    .filter((c) => c.items.length > 0);
}

/**
 * After place_order answers item_unavailable, which ids to take off the cart: a line's
 * item that is gone, sold out, hidden or add-on-only, and an add-on that is gone, sold
 * out, hidden, no longer add-on-only or no longer linked to that line's item. `orderable`
 * holds the available items in active categories, with their add-on-only flag.
 */
export function unorderableIds(
  lines: Array<{ itemId: string; addonIds: string[] }>,
  orderable: ReadonlyMap<string, boolean>,
  links: AddonLink[],
): string[] {
  const linked = new Set(links.map((l) => `${l.item_id}:${l.addon_id}`));
  const gone = new Set<string>();
  for (const line of lines) {
    if (orderable.get(line.itemId) !== false) gone.add(line.itemId);
    for (const addon of line.addonIds) {
      if (orderable.get(addon) !== true || !linked.has(`${line.itemId}:${addon}`)) gone.add(addon);
    }
  }
  return [...gone];
}

/**
 * For the portal's menu list: how many items each add-on goes with, and how many add-ons
 * each regular item offers, counting only links that reach diners (the shapeDinerMenu
 * rules, minus hidden categories, which the portal shows anyway).
 */
export function addonCounts(
  items: ReadonlyArray<Pick<MenuRow, "id" | "addon_only">>,
  links: AddonLink[],
): { goesWith: Map<string, number>; offers: Map<string, number> } {
  const addonOnly = new Map(items.map((i) => [i.id, i.addon_only]));
  const goesWith = new Map<string, number>();
  const offers = new Map<string, number>();
  for (const { item_id, addon_id } of links) {
    if (addonOnly.get(addon_id) !== true || addonOnly.get(item_id) !== false) continue;
    goesWith.set(addon_id, (goesWith.get(addon_id) ?? 0) + 1);
    offers.set(item_id, (offers.get(item_id) ?? 0) + 1);
  }
  return { goesWith, offers };
}

export type GoesWithGroup = { id: string; name: string; items: Array<{ id: string; name: string }> };

/**
 * The item form's add-on fields: every regular item that could take this add-on, grouped
 * by category in menu order (hidden categories marked, uncategorised last), which of them
 * it goes with now, and the add-ons this item offers if it is a regular item.
 */
export function addonFormFields(
  categories: ReadonlyArray<{ id: string; name: string; is_active: boolean }>,
  items: ReadonlyArray<MenuRow & { name: string }>,
  links: AddonLink[],
  itemId: string | null,
): { groups: GoesWithGroup[]; goesWith: string[]; offers: string[] } {
  const candidates = items.filter((i) => !i.addon_only && i.id !== itemId);
  const group = (id: string | null, name: string): GoesWithGroup => ({
    id: id ?? "none",
    name,
    items: candidates.filter((i) => i.category_id === id).map((i) => ({ id: i.id, name: i.name })),
  });
  const known = new Set(categories.map((c) => c.id));
  const groups = [
    ...categories.map((c) => group(c.id, c.is_active ? c.name : `${c.name} (hidden)`)),
    {
      ...group(null, "No category"),
      items: candidates
        .filter((i) => i.category_id === null || !known.has(i.category_id))
        .map((i) => ({ id: i.id, name: i.name })),
    },
  ].filter((g) => g.items.length > 0);

  const isCandidate = new Set(candidates.map((i) => i.id));
  const offered = new Set(links.filter((l) => l.item_id === itemId).map((l) => l.addon_id));
  return {
    groups,
    goesWith: links
      .filter((l) => l.addon_id === itemId && isCandidate.has(l.item_id))
      .map((l) => l.item_id),
    offers: items.filter((a) => a.addon_only && offered.has(a.id)).map((a) => a.name),
  };
}
