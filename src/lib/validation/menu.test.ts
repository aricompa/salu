import { describe, expect, it } from "vitest";
import {
  DIETARY_TAGS,
  MAX_PRICE_CENTS,
  centsToPriceInput,
  dietaryShort,
  itemFormValues,
  itemSchema,
  parsePriceToCents,
} from "./menu";

describe("parsePriceToCents", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    ["$12.50", 1250],
    [" 12.50 ", 1250],
    ["0", 0],
    [".5", 50],
    ["0.99", 99],
    ["10000", MAX_PRICE_CENTS],
    ["10000.00", MAX_PRICE_CENTS],
  ])("parses %j as %i cents", (input, cents) => {
    expect(parsePriceToCents(input)).toBe(cents);
  });

  it.each(["", ".", "12.555", "1e3", "-1", "10000.01", "12,50", "abc", "12.", "Infinity", "0x10"])(
    "rejects %j",
    (input) => {
      expect(parsePriceToCents(input)).toBeNull();
    },
  );

  it("never produces a float", () => {
    // 0.29 * 100 is 28.999999999999996 in floating point; integer math avoids it.
    expect(parsePriceToCents("0.29")).toBe(29);
    expect(parsePriceToCents("1.15")).toBe(115);
  });
});

describe("centsToPriceInput", () => {
  it("round-trips through parsePriceToCents", () => {
    for (const cents of [0, 5, 50, 99, 1250, 2400, MAX_PRICE_CENTS]) {
      expect(parsePriceToCents(centsToPriceInput(cents))).toBe(cents);
    }
  });

  it("refuses non-integer money", () => {
    expect(() => centsToPriceInput(12.5)).toThrow();
  });
});

describe("dietary tags", () => {
  it("has six fixed values with short chip text", () => {
    expect(DIETARY_TAGS.map((t) => t.value)).toEqual([
      "vegetarian",
      "vegan",
      "gluten-free",
      "dairy-free",
      "contains-nuts",
      "spicy",
    ]);
    expect(dietaryShort("gluten-free")).toBe("GF");
    expect(dietaryShort("unknown-tag")).toBe("unknown-tag");
  });
});

describe("itemSchema", () => {
  const form = (fields: Record<string, string | string[]>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      for (const one of Array.isArray(v) ? v : [v]) fd.append(k, one);
    }
    return itemFormValues(fd);
  };

  it("parses a full item to cents and nulls", () => {
    const parsed = itemSchema.parse(
      form({ name: " Lobster Roll ", description: "", price: "32", dietaryTags: ["spicy"] }),
    );
    expect(parsed).toEqual({
      name: "Lobster Roll",
      description: null,
      price: 3200,
      categoryId: null,
      dietaryTags: ["spicy"],
      isAvailable: false,
    });
  });

  it("reads the availability checkbox", () => {
    expect(itemSchema.parse(form({ name: "Tea", price: "3", isAvailable: "on" })).isAvailable).toBe(
      true,
    );
  });

  it("rejects a tag outside the vocabulary", () => {
    const result = itemSchema.safeParse(form({ name: "Tea", price: "3", dietaryTags: ["keto"] }));
    expect(result.success).toBe(false);
  });

  it("rejects a bad price with a field message", () => {
    const result = itemSchema.safeParse(form({ name: "Tea", price: "3.999" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["price"]);
  });

  it("rejects a category id that is not a uuid", () => {
    expect(itemSchema.safeParse(form({ name: "Tea", price: "3", categoryId: "1" })).success).toBe(
      false,
    );
  });

  it("enforces the database limits on name and description", () => {
    expect(itemSchema.safeParse(form({ name: "x".repeat(121), price: "1" })).success).toBe(false);
    expect(
      itemSchema.safeParse(form({ name: "Tea", price: "1", description: "x".repeat(501) })).success,
    ).toBe(false);
  });
});
