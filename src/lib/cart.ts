/**
 * The diner's cart: display-only prices (the database prices the order; rule 4), kept
 * in sessionStorage per table session. Pure functions plus a tiny store for React.
 */
export const MAX_LINES = 30;
export const MAX_QUANTITY = 50;
export const MAX_LINE_NOTES = 200;
/** place_order takes at most 10 different add-ons on a line. */
export const MAX_LINE_ADDONS = 10;

/** An add-on rides on its line: one per unit, so it follows the line's quantity. */
export type CartAddon = { itemId: string; name: string; priceCents: number };

export type CartLine = {
  itemId: string;
  name: string;
  priceCents: number;
  quantity: number;
  notes: string;
  addons: CartAddon[];
};

export type Cart = CartLine[];

const clampQuantity = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(n)));

/** What makes two lines the same: the item, its notes and its add-ons (in any order). */
export function lineKey(line: Pick<CartLine, "itemId" | "notes" | "addons">): string {
  return [line.itemId, line.notes, ...line.addons.map((a) => a.itemId).sort()].join("|");
}

/** One unit of the line: the item plus each of its add-ons. Display only (rule 4). */
export function lineUnitCents(line: Pick<CartLine, "priceCents" | "addons">): number {
  return line.priceCents + line.addons.reduce((sum, a) => sum + a.priceCents, 0);
}

/**
 * Same item with the same notes and add-ons merges into one line; anything different
 * stays separate, so two burgers with different add-ons are two lines.
 */
export function addLine(cart: Cart, line: CartLine): Cart {
  const notes = line.notes.trim().slice(0, MAX_LINE_NOTES);
  const addons = line.addons
    .filter((a, i, all) => all.findIndex((b) => b.itemId === a.itemId) === i)
    .slice(0, MAX_LINE_ADDONS);
  const key = lineKey({ itemId: line.itemId, notes, addons });
  const i = cart.findIndex((l) => lineKey(l) === key);
  if (i >= 0) {
    return cart.map((l, j) =>
      j === i ? { ...l, quantity: clampQuantity(l.quantity + line.quantity) } : l,
    );
  }
  if (cart.length >= MAX_LINES) return cart;
  return [...cart, { ...line, notes, addons, quantity: clampQuantity(line.quantity) }];
}

export function setQuantity(cart: Cart, index: number, quantity: number): Cart {
  return cart.map((l, i) => (i === index ? { ...l, quantity: clampQuantity(quantity) } : l));
}

export function removeLine(cart: Cart, index: number): Cart {
  return cart.filter((_, i) => i !== index);
}

/**
 * Takes sold-out items off the cart: a line whose item is gone, and a gone add-on from
 * every line that has it (the item stays). Lines that become the same merge.
 */
export function removeItems(cart: Cart, itemIds: ReadonlySet<string>): Cart {
  return cart
    .filter((l) => !itemIds.has(l.itemId))
    .map((l) => ({ ...l, addons: l.addons.filter((a) => !itemIds.has(a.itemId)) }))
    .reduce<Cart>((kept, l) => addLine(kept, l), []);
}

/** Names of the items and add-ons in the cart with these ids, for the sold-out message. */
export function namesOf(cart: Cart, itemIds: ReadonlySet<string>): string[] {
  return cart.flatMap((l) => [
    ...(itemIds.has(l.itemId) ? [l.name] : []),
    ...l.addons.filter((a) => itemIds.has(a.itemId)).map((a) => a.name),
  ]);
}

export function cartTotals(cart: Cart): { count: number; subtotalCents: number } {
  return cart.reduce(
    (t, l) => ({
      count: t.count + l.quantity,
      subtotalCents: t.subtotalCents + lineUnitCents(l) * l.quantity,
    }),
    { count: 0, subtotalCents: 0 },
  );
}

export function cartStorageKey(token: string, sessionId: string): string {
  return `salu:cart:${token}:${sessionId}`;
}

const isAddon = (v: unknown): v is CartAddon => {
  const a = v as CartAddon;
  return (
    !!a && typeof a.itemId === "string" && typeof a.name === "string" && Number.isInteger(a.priceCents)
  );
};

// A cart saved before add-ons existed has no `addons`; it reads as a line without any.
const isLine = (v: unknown): v is Omit<CartLine, "addons"> & { addons?: unknown } => {
  const l = v as CartLine;
  return (
    !!l &&
    typeof l.itemId === "string" &&
    typeof l.name === "string" &&
    Number.isInteger(l.priceCents) &&
    Number.isInteger(l.quantity) &&
    typeof l.notes === "string" &&
    (l.addons === undefined || (Array.isArray(l.addons) && l.addons.every(isAddon)))
  );
};

/** Reads a cart; storage that throws (private mode, blocked) or holds junk reads as empty. */
export function loadCart(storage: Pick<Storage, "getItem"> | undefined, key: string): Cart {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isLine)
      .slice(0, MAX_LINES)
      .map((l) => ({ ...l, addons: (l.addons as CartAddon[] | undefined) ?? [] }));
  } catch {
    return [];
  }
}

/** Saves a cart; a storage failure only costs persistence across reloads, never the order. */
export function saveCart(
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined,
  key: string,
  cart: Cart,
): void {
  try {
    if (cart.length === 0) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(cart));
  } catch {
    // Keep going with the in-memory cart.
  }
}

/** PRD 5.7: "Sorry, Lobster Roll just sold out. We took it off your order." */
export function soldOutMessage(names: string[]): string {
  const unique = [...new Set(names)];
  if (unique.length === 0) return "Sorry, something in your order just sold out. We took it off.";
  const list =
    unique.length === 1
      ? unique[0]
      : `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
  return `Sorry, ${list} just sold out. We took ${unique.length === 1 ? "it" : "them"} off your order.`;
}
