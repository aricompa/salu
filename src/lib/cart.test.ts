import { describe, expect, it, vi } from "vitest";
import {
  MAX_LINES,
  addLine,
  cartTotals,
  lineKey,
  lineUnitCents,
  loadCart,
  namesOf,
  removeItems,
  removeLine,
  saveCart,
  setQuantity,
  soldOutMessage,
  type CartLine,
} from "./cart";

const salmon: CartLine = {
  itemId: "s",
  name: "Salmon",
  priceCents: 2400,
  quantity: 1,
  notes: "",
  addons: [],
};
const patty = { itemId: "p", name: "Add Patty", priceCents: 600 };
const bacon = { itemId: "b", name: "Add Bacon", priceCents: 300 };
const burger: CartLine = { ...salmon, itemId: "m", name: "Mason Burger", priceCents: 1500 };

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

describe("cart add-ons", () => {
  it("prices a unit as the item plus its add-ons, for every unit", () => {
    const cart = addLine([], { ...burger, quantity: 2, addons: [patty, bacon] });
    expect(lineUnitCents(cart[0])).toBe(2400);
    expect(cartTotals(cart)).toEqual({ count: 2, subtotalCents: 4800 });
  });

  it("keeps two burgers with different add-ons apart, and merges the same add-ons in any order", () => {
    let cart = addLine([], { ...burger, addons: [patty] });
    cart = addLine(cart, burger);
    cart = addLine(cart, { ...burger, addons: [patty, bacon] });
    cart = addLine(cart, { ...burger, addons: [bacon, patty] });
    expect(cart.map((l) => [l.addons.map((a) => a.name), l.quantity])).toEqual([
      [["Add Patty"], 1],
      [[], 1],
      [["Add Patty", "Add Bacon"], 2],
    ]);
    expect(new Set(cart.map(lineKey)).size).toBe(3);
  });

  it("drops a repeated add-on and caps a line at 10", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...patty, itemId: `a${i}` }));
    expect(addLine([], { ...burger, addons: [patty, patty] })[0].addons).toEqual([patty]);
    expect(addLine([], { ...burger, addons: many })[0].addons).toHaveLength(10);
  });

  it("takes a sold-out add-on off every line but keeps the item, merging lines that match", () => {
    const cart: CartLine[] = [
      { ...burger, addons: [patty] },
      { ...burger, quantity: 2 },
      { ...salmon, addons: [bacon] },
    ];
    expect(removeItems(cart, new Set(["p"]))).toEqual([
      { ...burger, quantity: 3 },
      { ...salmon, addons: [bacon] },
    ]);
    expect(namesOf(cart, new Set(["p", "s"]))).toEqual(["Add Patty", "Salmon"]);
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

  it("reads a cart saved before add-ons existed, and drops junk add-ons", () => {
    const { addons: _ignored, ...old } = salmon;
    void _ignored;
    expect(loadCart({ getItem: () => JSON.stringify([old]) }, "k")).toEqual([salmon]);
    expect(
      loadCart({ getItem: () => JSON.stringify([{ ...salmon, addons: [{ itemId: 1 }] }]) }, "k"),
    ).toEqual([]);
  });
});

describe("soldOutMessage", () => {
  it("names what sold out, in PRD 5.7's words", () => {
    expect(soldOutMessage(["Lobster Roll"])).toBe(
      "Sorry, Lobster Roll just sold out. We took it off your order.",
    );
    expect(soldOutMessage(["Lobster Roll", "Burrata", "Lobster Roll"])).toBe(
      "Sorry, Lobster Roll and Burrata just sold out. We took them off your order.",
    );
    expect(soldOutMessage(["A", "B", "C"])).toBe(
      "Sorry, A, B and C just sold out. We took them off your order.",
    );
    expect(soldOutMessage([])).toContain("something in your order");
  });
});
