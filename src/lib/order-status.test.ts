import { describe, expect, it } from "vitest";
import { STATUS_COPY, timelineSteps } from "./order-status";

describe("timelineSteps", () => {
  it("marks earlier steps done and the current one current", () => {
    expect(timelineSteps("accepted").map((s) => s.state)).toEqual([
      "done",
      "current",
      "upcoming",
      "upcoming",
    ]);
  });

  it("shows a ready order as still Preparing: diners never see Ready (ruled 2026-09-30)", () => {
    expect(timelineSteps("ready").map((s) => `${s.label}:${s.state}`)).toEqual([
      "Sent:done",
      "Accepted:done",
      "Preparing:current",
      "Served:upcoming",
    ]);
    expect(timelineSteps("preparing")).toEqual(timelineSteps("ready"));
    expect(STATUS_COPY.ready).toBe(STATUS_COPY.preparing);
    expect(Object.values(STATUS_COPY).join(" ")).not.toMatch(/\bReady\b/);
  });

  it("completes on served and has no timeline when cancelled", () => {
    expect(timelineSteps("served").every((s) => s.state === "done")).toBe(true);
    expect(timelineSteps("cancelled")).toEqual([]);
  });

  it("uses PRD 5.7's words", () => {
    expect(STATUS_COPY.submitted).toBe("Your order's in. The kitchen has it.");
    expect(STATUS_COPY.preparing).toBe("Preparing. It's being made now.");
  });
});
