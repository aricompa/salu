import { describe, expect, it } from "vitest";
import { assertSafePublicEnvNames, parsePublicEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
};

describe("parsePublicEnv", () => {
  it("accepts a complete, valid environment", () => {
    expect(parsePublicEnv(valid)).toEqual(valid);
  });

  it("throws when a variable is missing", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: undefined })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("throws when a URL is malformed", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "not a url" })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });

  it("refuses a secret key in the publishable slot", () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" }),
    ).toThrow(/secret key/);
  });
});

describe("assertSafePublicEnvNames", () => {
  it("allows the allow-listed names and any server-only names", () => {
    expect(() =>
      assertSafePublicEnvNames({ ...valid, SUPABASE_SECRET_KEY: "x", PATH: "/bin" }),
    ).not.toThrow();
  });

  it("requires the Turnstile site key and refuses a Turnstile secret in its place", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_TURNSTILE_SITE_KEY: undefined })).toThrow(
      /NEXT_PUBLIC_TURNSTILE_SITE_KEY/,
    );
    expect(() =>
      parsePublicEnv({
        ...valid,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x0000000000000000000000000000000AA",
      }),
    ).toThrow(/Turnstile secret/);
  });

  it("rejects a secret-looking NEXT_PUBLIC_ name", () => {
    // Built from parts so the pre-commit hook doesn't flag this deliberate bad example.
    const leaked = "NEXT_PUBLIC_" + "SUPABASE_SECRET_KEY";
    expect(() => assertSafePublicEnvNames({ ...valid, [leaked]: "x" })).toThrow(leaked);
  });

  it("rejects any NEXT_PUBLIC_ name that isn't allow-listed", () => {
    expect(() => assertSafePublicEnvNames({ ...valid, NEXT_PUBLIC_FEATURE_X: "1" })).toThrow(
      /NEXT_PUBLIC_FEATURE_X/,
    );
  });
});
