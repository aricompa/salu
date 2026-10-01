import { describe, expect, it } from "vitest";
import {
  decodeDinerCookie,
  displayNameSchema,
  encodeDinerCookie,
  qrTokenSchema,
  type DinerTable,
} from "./diner";

const table: DinerTable = {
  sessionId: "5d2f838d-4756-48cb-81b5-7b046b7e0217",
  restaurantId: "00000000-0000-4000-8000-000000000001",
  restaurantName: "Café Olé & Co.",
  tableLabel: "Patio 1",
};

describe("diner table cookie", () => {
  it("round-trips, including non-ASCII names", () => {
    expect(decodeDinerCookie(encodeDinerCookie(table))).toEqual(table);
  });

  it.each([
    undefined,
    "",
    "not json",
    "%7B%22sessionId%22%3A%22x%22%7D",
    encodeURIComponent(JSON.stringify({ ...table, sessionId: "not-a-uuid" })),
    encodeURIComponent(JSON.stringify({ ...table, tableLabel: "" })),
    "%E0%A4%A",
  ])("reads a missing, garbled or tampered cookie %j as no table", (raw) => {
    expect(decodeDinerCookie(raw)).toBeNull();
  });
});

describe("qrTokenSchema", () => {
  it("accepts only the database's 32-hex token shape", () => {
    expect(qrTokenSchema.safeParse("5d2f838d475648cb81b57b046b7e0217").success).toBe(true);
    for (const bad of [
      "",
      "0".repeat(31),
      "Z".repeat(32),
      "../menu",
      "5D2F838D475648CB81B57B046B7E0217",
    ])
      expect(qrTokenSchema.safeParse(bad).success).toBe(false);
  });
});

describe("displayNameSchema", () => {
  it("trims and accepts 1 to 40 characters, as the database does", () => {
    expect(displayNameSchema.parse("  Ari  ")).toBe("Ari");
    expect(displayNameSchema.parse("é".repeat(40))).toHaveLength(40);
    expect(displayNameSchema.safeParse("   ").success).toBe(false);
    expect(displayNameSchema.safeParse("x".repeat(41)).success).toBe(false);
  });
});
