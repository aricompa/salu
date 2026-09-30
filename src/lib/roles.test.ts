import { describe, expect, it } from "vitest";
import { canManage } from "./roles";

describe("canManage", () => {
  it("lets owners and managers edit, not floor staff", () => {
    expect(canManage("owner")).toBe(true);
    expect(canManage("manager")).toBe(true);
    expect(canManage("staff")).toBe(false);
  });
});
