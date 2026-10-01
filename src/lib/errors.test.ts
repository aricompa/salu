import { describe, expect, it } from "vitest";
import { ERROR_COPY, fail, isConnectionFailure, toAppError, type AppErrorCode } from "./errors";

// Every hint the Phase 1 migrations raise. CLAUDE.md lists the first five.
const DB_HINTS: AppErrorCode[] = [
  "invalid_table",
  "table_not_open",
  "item_unavailable",
  "session_closed",
  "rate_limited",
  "invalid_transition",
  "not_participant",
  "invalid_items",
  "restaurant_limit",
  "invalid_timezone",
];

describe("toAppError", () => {
  it.each(DB_HINTS)("maps DB hint %s to its own friendly copy", (hint) => {
    const err = toAppError({ code: "P0001", hint, message: "raw db text" });
    expect(err.code).toBe(hint);
    expect(err.message).toBe(ERROR_COPY[hint]);
    expect(err.message).not.toContain("raw db text");
  });

  it("maps a unique violation to slug_taken", () => {
    expect(toAppError({ code: "23505" }).message).toBe("That link is taken. Try another.");
  });

  it("lets the caller name what a unique violation means", () => {
    expect(toAppError({ code: "23505" }, { unique: "label_taken" })).toEqual({
      code: "label_taken",
      message: ERROR_COPY.label_taken,
    });
  });

  it("maps insufficient privilege to not_allowed", () => {
    expect(toAppError({ code: "42501", hint: null }).code).toBe("not_allowed");
  });

  it("falls back to unknown for anything else, without leaking DB text", () => {
    const err = toAppError({ code: "XX000", hint: "something_new", message: "internal detail" });
    expect(err.code).toBe("unknown");
    expect(err.message).not.toContain("internal detail");
  });

  it("handles a missing error", () => {
    expect(toAppError(null).code).toBe("unknown");
  });
});

describe("copy", () => {
  it("has non-empty copy for every code", () => {
    for (const message of Object.values(ERROR_COPY))
      expect(message.trim().length).toBeGreaterThan(0);
  });

  it("fail() builds a typed failure", () => {
    expect(fail("rate_limited")).toEqual({
      ok: false,
      error: { code: "rate_limited", message: ERROR_COPY.rate_limited },
    });
  });
});

describe("drift guard", () => {
  it("every hint raised in a migration has friendly copy", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const dir = "supabase/migrations";
    const sql = readdirSync(dir)
      .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      .join("\n");
    const hints = [...sql.matchAll(/hint\s*=\s*'([a-z_]+)'/g)].map((m) => m[1]);
    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) expect(Object.keys(ERROR_COPY)).toContain(hint);
  });
});

describe("isConnectionFailure", () => {
  it("is a failed fetch or an offline device, and nothing else", () => {
    expect(isConnectionFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(
      isConnectionFailure(new Error("An unexpected response was received from the server.")),
    ).toBe(false);
    expect(isConnectionFailure(undefined)).toBe(false);
  });
});
