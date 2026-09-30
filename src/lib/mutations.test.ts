import { describe, expect, it, vi } from "vitest";

// The marker only guards against client imports; the logic under test is plain.
vi.mock("server-only", () => ({}));
const { oneRowChanged, reorder } = await import("./mutations");

describe("oneRowChanged", () => {
  it("passes one changed row", () => {
    expect(oneRowChanged({ data: [{ id: "a" }], error: null })).toEqual({ ok: true, data: null });
  });

  it("treats 0 rows as not allowed, because RLS filters without raising", () => {
    expect(oneRowChanged({ data: [], error: null })).toMatchObject({
      ok: false,
      error: { code: "not_allowed" },
    });
    expect(oneRowChanged({ data: null, error: null })).toMatchObject({
      ok: false,
      error: { code: "not_allowed" },
    });
  });

  it("maps a database error through toAppError, with the caller's unique meaning", () => {
    expect(
      oneRowChanged({ data: null, error: { code: "23505" } }, { unique: "label_taken" }),
    ).toMatchObject({ ok: false, error: { code: "label_taken" } });
    expect(oneRowChanged({ data: null, error: { code: "42501" } })).toMatchObject({
      ok: false,
      error: { code: "not_allowed" },
    });
  });
});

describe("reorder", () => {
  const rows = [
    { id: "a", sort_order: 0 },
    { id: "b", sort_order: 0 },
    { id: "c", sort_order: 0 },
  ];

  it("swaps with the neighbour and renumbers only rows that moved", async () => {
    const writes: Array<[string, number]> = [];
    const result = await reorder(rows, "c", "up", async (id, order) => {
      writes.push([id, order]);
      return { ok: true, data: null };
    });
    expect(result.ok).toBe(true);
    // new order a, c, b -> a keeps 0; c becomes 1; b becomes 2
    expect(writes).toEqual([
      ["c", 1],
      ["b", 2],
    ]);
  });

  it("is a no-op at the ends", async () => {
    const write = vi.fn();
    expect(await reorder(rows, "a", "up", write)).toEqual({ ok: true, data: null });
    expect(await reorder(rows, "c", "down", write)).toEqual({ ok: true, data: null });
    expect(write).not.toHaveBeenCalled();
  });

  it("reports a missing row and stops at the first failed write", async () => {
    expect(await reorder(rows, "zz", "up", vi.fn())).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
    const write = vi.fn(async () => ({
      ok: false as const,
      error: { code: "not_allowed" as const, message: "no" },
    }));
    expect(await reorder(rows, "c", "up", write)).toMatchObject({ ok: false });
    expect(write).toHaveBeenCalledOnce();
  });
});
