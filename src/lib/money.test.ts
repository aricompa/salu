import { describe, expect, it } from "vitest";
import { formatCents } from "./money";

describe("formatCents", () => {
  it("formats integer cents as dollars", () => {
    expect(formatCents(2400)).toBe("$24.00");
    expect(formatCents(5)).toBe("$0.05");
  });

  it("rejects non-integer amounts", () => {
    expect(() => formatCents(24.5)).toThrow(/integer cents/);
  });
});
