import { describe, expect, it } from "vitest";
import { isStaffClaims } from "./staff-claims";

describe("isStaffClaims", () => {
  it("accepts a permanent user", () => {
    expect(isStaffClaims({ sub: "u1", is_anonymous: false })).toBe(true);
  });

  it.each([
    ["anonymous diner", { sub: "u1", is_anonymous: true }],
    ["missing is_anonymous claim (fails closed)", { sub: "u1" }],
    ["no subject", { is_anonymous: false }],
    ["empty subject", { sub: "", is_anonymous: false }],
    ["string 'false'", { sub: "u1", is_anonymous: "false" }],
    ["signed out", null],
  ])("rejects %s", (_label, claims) => {
    expect(isStaffClaims(claims)).toBe(false);
  });
});
