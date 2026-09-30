import { describe, expect, it } from "vitest";
import { STATUS_COPY, timelineSteps } from "./order-status";

describe("timelineSteps", () => {
  it("marks earlier steps done and the current one current", () => {
    expect(timelineSteps("accepted").map((s) => s.state)).toEqual([
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("treats a skipped Preparing step as done once the order is ready", () => {
    expect(timelineSteps("ready").map((s) => `${s.label}:${s.state}`)).toEqual([
      "Sent:done",
      "Accepted:done",
      "Preparing:done",
      "Ready:current",
      "Served:upcoming",
    ]);
  });

  it("completes on served and has no timeline when cancelled", () => {
    expect(timelineSteps("served").every((s) => s.state === "done")).toBe(true);
    expect(timelineSteps("cancelled")).toEqual([]);
  });

  it("uses PRD 5.7's words", () => {
    expect(STATUS_COPY.submitted).toBe("Your order's in. The kitchen has it.");
    expect(STATUS_COPY.ready).toBe("Ready. It's coming to your table.");
  });
});
