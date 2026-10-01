import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveOrder } from "./BoardLive";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

type Handlers = { onChange: () => void; onLive: () => void; onInterrupted: () => void };
let handlers: Handlers;
const unsubscribe = vi.fn();
vi.mock("@/lib/realtime", () => ({
  subscribeToRestaurantOrders: vi.fn((_id: string, h: Handlers) => {
    handlers = h;
    return unsubscribe;
  }),
}));

const { BoardLive } = await import("./BoardLive");
const { OrderCardFrame } = await import("./OrderCardFrame");

const live = (orders: LiveOrder[]) => (
  <BoardLive restaurantId="r1" orders={orders}>
    {orders.map((o) => (
      <OrderCardFrame key={o.id} id={o.id} labelledBy={o.id} waiting={o.status === "submitted"}>
        <h3 id={o.id}>{o.tableLabel}</h3>
      </OrderCardFrame>
    ))}
  </BoardLive>
);
const announcer = () => document.querySelector('[aria-live="polite"]') as HTMLElement;
const pulsing = (name: string) =>
  screen.getByRole("article", { name }).className.includes("animate-[order-pulse");

describe("BoardLive", () => {
  beforeEach(() => {
    refresh.mockClear();
    unsubscribe.mockClear();
  });

  it("says when it's live or reconnecting, and refreshes when the feed is ready", () => {
    const { unmount } = render(live([]));
    expect(screen.getByText("Connecting…")).toBeVisible();

    act(() => handlers.onLive());
    expect(screen.getByText("Live")).toBeVisible();
    expect(refresh).toHaveBeenCalledOnce();

    act(() => handlers.onInterrupted());
    expect(screen.getByText("Reconnecting…")).toBeVisible();

    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("coalesces a burst of changes into one refresh", () => {
    render(live([]));
    act(() => {
      handlers.onChange();
      handlers.onChange();
      handlers.onChange();
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("alerts for orders that arrive after the board opened, never for the first render", () => {
    const a1: LiveOrder = { id: "o1", status: "submitted", tableLabel: "A1" };
    const { rerender } = render(live([a1]));
    expect(announcer()).toHaveTextContent("");
    expect(pulsing("A1")).toBe(false);

    const b2: LiveOrder = { id: "o2", status: "submitted", tableLabel: "B2" };
    rerender(live([a1, b2]));
    expect(announcer()).toHaveTextContent("New order for B2.");
    expect(pulsing("B2")).toBe(true);
    expect(pulsing("A1")).toBe(false);

    // Accepted elsewhere before this board saw it: no alert.
    const c3: LiveOrder = { id: "o3", status: "accepted", tableLabel: "C3" };
    rerender(live([a1, b2, c3]));
    expect(announcer()).toHaveTextContent("New order for B2.");
    expect(pulsing("C3")).toBe(false);

    const d4: LiveOrder = { id: "o4", status: "submitted", tableLabel: "D4" };
    const e5: LiveOrder = { id: "o5", status: "submitted", tableLabel: "E5" };
    rerender(live([a1, b2, c3, d4, e5]));
    expect(announcer()).toHaveTextContent("2 new orders: D4, E5.");
  });

  it("says so when this browser can't play sound", () => {
    render(live([]));
    expect(screen.getByText("Sound isn't available in this browser.")).toBeVisible();
  });
});
