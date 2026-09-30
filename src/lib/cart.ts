/**
 * The diner's cart: display-only prices (the database prices the order; rule 4), kept
 * in sessionStorage per table session. Pure functions plus a tiny store for React.
 */
export const MAX_LINES = 30;
export const MAX_QUANTITY = 50;
export const MAX_LINE_NOTES = 200;

export type CartLine = {
  itemId: string;
  name: string;
  priceCents: number;
  quantity: number;
  notes: string;
};

export type Cart = CartLine[];

const clampQuantity = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(n)));

/** Same item with the same notes merges into one line; different notes stay separate. */
export function addLine(cart: Cart, line: CartLine): Cart {
  const notes = line.notes.trim().slice(0, MAX_LINE_NOTES);
  const i = cart.findIndex((l) => l.itemId === line.itemId && l.notes === notes);
  if (i >= 0) {
    return cart.map((l, j) =>
      j === i ? { ...l, quantity: clampQuantity(l.quantity + line.quantity) } : l,
    );
  }
  if (cart.length >= MAX_LINES) return cart;
  return [...cart, { ...line, notes, quantity: clampQuantity(line.quantity) }];
}

export function setQuantity(cart: Cart, index: number, quantity: number): Cart {
  return cart.map((l, i) => (i === index ? { ...l, quantity: clampQuantity(quantity) } : l));
}

export function removeLine(cart: Cart, index: number): Cart {
  return cart.filter((_, i) => i !== index);
}

export function removeItems(cart: Cart, itemIds: ReadonlySet<string>): Cart {
  return cart.filter((l) => !itemIds.has(l.itemId));
}

export function cartTotals(cart: Cart): { count: number; subtotalCents: number } {
  return cart.reduce(
    (t, l) => ({
      count: t.count + l.quantity,
      subtotalCents: t.subtotalCents + l.priceCents * l.quantity,
    }),
    { count: 0, subtotalCents: 0 },
  );
}

export function cartStorageKey(token: string, sessionId: string): string {
  return `salu:cart:${token}:${sessionId}`;
}

const isLine = (v: unknown): v is CartLine => {
  const l = v as CartLine;
  return (
    !!l &&
    typeof l.itemId === "string" &&
    typeof l.name === "string" &&
    Number.isInteger(l.priceCents) &&
    Number.isInteger(l.quantity) &&
    typeof l.notes === "string"
  );
};

/** Reads a cart; storage that throws (private mode, blocked) or holds junk reads as empty. */
export function loadCart(storage: Pick<Storage, "getItem"> | undefined, key: string): Cart {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isLine).slice(0, MAX_LINES) : [];
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
