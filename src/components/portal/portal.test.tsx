import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KitchenClock, formatKitchenTime } from "./KitchenClock";
import { OfflineBanner } from "./OfflineBanner";

describe("KitchenClock", () => {
  it("shows the time in the restaurant's zone", () => {
    const at = new Date("2026-09-29T23:42:00Z");
    expect(formatKitchenTime("America/New_York", at)).toBe("7:42 PM");
    expect(formatKitchenTime("Asia/Tokyo", at)).toBe("8:42 AM");
  });

  it("never throws on a zone the device doesn't know", () => {
    expect(formatKitchenTime("Mars/Olympus", new Date())).toBeNull();
    render(<KitchenClock timeZone="Mars/Olympus" />);
    expect(screen.getByText("Time zone not recognised. Check Settings.")).toBeInTheDocument();
  });
});

describe("OfflineBanner", () => {
  afterEach(() => vi.restoreAllMocks());

  it("appears when the connection drops and clears when it returns", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).toBeNull();

    onLine.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(screen.getByRole("status")).toHaveTextContent("You're offline.");

    onLine.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event("online")));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
