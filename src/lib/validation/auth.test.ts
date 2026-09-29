import { describe, expect, it } from "vitest";
import { credentialsSchema, safeNextPath } from "./auth";

describe("credentialsSchema", () => {
  it("normalizes email and accepts a 10+ character password", () => {
    const parsed = credentialsSchema.parse({
      email: " Owner@Example.com ",
      password: "correct-horse",
    });
    expect(parsed.email).toBe("owner@example.com");
  });

  it("rejects short passwords and bad emails", () => {
    const result = credentialsSchema.safeParse({ email: "nope", password: "short" });
    expect(result.success).toBe(false);
    const errors = result.error!.flatten().fieldErrors;
    expect(errors.email?.[0]).toMatch(/valid email/);
    expect(errors.password?.[0]).toMatch(/10 characters/);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/restaurant/onboarding", "/restaurant/onboarding"],
    [null, "/fallback"],
    ["https://evil.example", "/fallback"],
    ["//evil.example", "/fallback"],
    ["/\\evil.example", "/fallback"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input, "/fallback")).toBe(expected);
  });
});
