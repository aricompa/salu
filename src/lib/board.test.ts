import { describe, expect, it } from "vitest";
import { NEXT_ACTION, averageServeMinutes, canCancel, dinerLabels, ticketAge } from "./board";

describe("ticketAge", () => {
  const at = (mins: number) => new Date(Date.parse("2026-09-30T18:00:00Z") + mins * 60_000);
  const placed = "2026-09-30T18:00:00Z";

  it("carries text with every tone (color is never the only signal)", () => {
    expect(ticketAge(placed, at(0))).toEqual({ minutes: 0, tone: "neutral", text: "Just now" });
    expect(ticketAge(placed, at(6.5))).toEqual({ minutes: 6, tone: "neutral", text: "6 min" });
    expect(ticketAge(placed, at(10))).toEqual({
      minutes: 10,
      tone: "warning",
      text: "10 min · Long wait",
    });
    expect(ticketAge(placed, at(20))).toEqual({
      minutes: 20,
      tone: "danger",
      text: "20 min · Overdue",
    });
  });

  it("never shows a negative age when the device clock runs behind", () => {
    expect(ticketAge(placed, at(-2)).text).toBe("Just now");
  });
});

describe("dinerLabels", () => {
  it("uses the name, or Guest N by join order", () => {
    const labels = dinerLabels([
      { user_id: "c", display_name: null, joined_at: "2026-09-30T18:05:00Z" },
      { user_id: "a", display_name: "Ari", joined_at: "2026-09-30T18:00:00Z" },
      { user_id: "b", display_name: null, joined_at: "2026-09-30T18:01:00Z" },
    ]);
    expect(Object.fromEntries(labels)).toEqual({ a: "Ari", b: "Guest 2", c: "Guest 3" });
  });
});

describe("board actions", () => {
  it("offers one next step per column, and cancel only where the database allows it", () => {
    expect(NEXT_ACTION.accepted).toEqual({ to: "preparing", label: "Start preparing" });
    expect(["submitted", "accepted", "preparing"].every((s) => canCancel(s as never))).toBe(true);
    expect(canCancel("ready")).toBe(false);
    expect(canCancel("served")).toBe(false);
  });
});

describe("averageServeMinutes", () => {
  it("averages sent to served, to the minute, and is null when nothing was served", () => {
    expect(averageServeMinutes([])).toBeNull();
    expect(
      averageServeMinutes([
        { submitted_at: "2026-09-30T18:00:00Z", served_at: "2026-09-30T18:10:00Z" },
        { submitted_at: "2026-09-30T18:00:00Z", served_at: "2026-09-30T18:21:00Z" },
        { submitted_at: "2026-09-30T18:00:00Z", served_at: null },
      ]),
    ).toBe(16);
  });
});
