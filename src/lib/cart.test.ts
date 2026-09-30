import { describe, expect, it, vi } from "vitest";
import {
  MAX_LINES,
  addLine,
  cartTotals,
  loadCart,
  removeItems,
  removeLine,
  saveCart,
  setQuantity,
  type CartLine,
} from "./cart";

const salmon: CartLine = { itemId: "s", name: "Salmon", priceCents: 2400, quantity: 1, notes: "" };

describe("cart", () => {
  it("merges the same item with the same notes, keeps different notes apart", () => {
    let cart = addLine([], salmon);
    cart = addLine(cart, { ...salmon, quantity: 2 });
    cart = addLine(cart, { ...salmon, notes: " no capers " });
    expect(cart).toEqual([
      { ...salmon, quantity: 3 },
      { ...salmon, notes: "no capers" },
    ]);
    expect(cartTotals(cart)).toEqual({ count: 4, subtotalCents: 9600 });
  });

  it("keeps quantities between 1 and 50 and caps the line count", () => {
    expect(addLine([], { ...salmon, quantity: 99 })[0].quantity).toBe(50);
    expect(setQuantity([salmon], 0, 0)[0].quantity).toBe(1);
    const full = Array.from({ length: MAX_LINES }, (_, i) => ({ ...salmon, itemId: `i${i}` }));
    expect(addLine(full, { ...salmon, itemId: "new" })).toHaveLength(MAX_LINES);
  });

  it("removes a line, and every line of sold-out items", () => {
    const cart = [salmon, { ...salmon, itemId: "t" }, { ...salmon, notes: "x" }];
    expect(removeLine(cart, 1)).toHaveLength(2);
    expect(removeItems(cart, new Set(["s"]))).toEqual([{ ...salmon, itemId: "t" }]);
  });
});

describe("cart storage", () => {
  it("round-trips through storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    saveCart(storage, "k", [salmon]);
    expect(loadCart(storage, "k")).toEqual([salmon]);
    saveCart(storage, "k", []);
    expect(store.has("k")).toBe(false);
  });

  it("survives storage that throws or holds junk", () => {
    const throwing = {
      getItem: vi.fn(() => {
        throw new Error("SecurityError");
      }),
      setItem: vi.fn(() => {
        throw new Error("QuotaExceeded");
      }),
      removeItem: vi.fn(),
    };
    expect(loadCart(throwing, "k")).toEqual([]);
    expect(() => saveCart(throwing, "k", [salmon])).not.toThrow();
    expect(loadCart({ getItem: () => "{not json" }, "k")).toEqual([]);
    expect(loadCart({ getItem: () => JSON.stringify([salmon, { itemId: 1 }]) }, "k")).toEqual([
      salmon,
    ]);
    expect(loadCart(undefined, "k")).toEqual([]);
  });
});
