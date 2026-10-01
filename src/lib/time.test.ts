import { describe, expect, it } from "vitest";
import { formatTimeIn, startOfDayIn } from "./time";

describe("startOfDayIn", () => {
  it("finds midnight in the restaurant's zone, not the server's", () => {
    const now = new Date("2026-09-30T02:30:00Z"); // 22:30 on the 29th in New York
    expect(startOfDayIn("America/New_York", now).toISOString()).toBe("2026-09-29T04:00:00.000Z");
    expect(startOfDayIn("Asia/Tokyo", now).toISOString()).toBe("2026-09-29T15:00:00.000Z");
    expect(startOfDayIn("UTC", now).toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });

  it("is right on both DST change days", () => {
    // Clocks spring forward at 02:00 on 2026-03-08 and fall back at 02:00 on 2026-11-01.
    expect(startOfDayIn("America/New_York", new Date("2026-03-08T20:00:00Z")).toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(startOfDayIn("America/New_York", new Date("2026-11-01T20:00:00Z")).toISOString()).toBe(
      "2026-11-01T04:00:00.000Z",
    );
  });

  it("starts at 01:00 where the clocks skip midnight", () => {
    // Santiago springs forward at 00:00 on 2026-09-06: the day starts at 01:00 (-03).
    expect(startOfDayIn("America/Santiago", new Date("2026-09-06T18:00:00Z")).toISOString()).toBe(
      "2026-09-06T04:00:00.000Z",
    );
  });

  it("never throws on a zone the runtime doesn't know", () => {
    expect(startOfDayIn("Mars/Olympus", new Date("2026-09-30T13:00:00Z")).toISOString()).toBe(
      "2026-09-30T00:00:00.000Z",
    );
  });
});

describe("formatTimeIn", () => {
  it("formats in the restaurant's zone and falls back to UTC", () => {
    const at = new Date("2026-09-29T23:42:00Z");
    expect(formatTimeIn("America/New_York", at)).toBe("7:42 PM");
    expect(formatTimeIn("Mars/Olympus", at)).toBe("23:42 UTC");
  });
});
