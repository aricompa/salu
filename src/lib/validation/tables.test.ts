import { describe, expect, it } from "vitest";
import { tableSchema } from "./tables";

describe("tableSchema", () => {
  it("trims the label and treats empty seats as unknown", () => {
    expect(tableSchema.parse({ label: " A4 ", capacity: "" })).toEqual({
      label: "A4",
      capacity: null,
    });
  });

  it("parses seats as a whole number", () => {
    expect(tableSchema.parse({ label: "A4", capacity: "4" }).capacity).toBe(4);
  });

  it.each(["0", "101", "2.5", "-1", "four"])("rejects %j seats", (capacity) => {
    expect(tableSchema.safeParse({ label: "A4", capacity }).success).toBe(false);
  });

  it("enforces the database label limits", () => {
    expect(tableSchema.safeParse({ label: "", capacity: "" }).success).toBe(false);
    expect(tableSchema.safeParse({ label: "x".repeat(41), capacity: "" }).success).toBe(false);
  });
});
