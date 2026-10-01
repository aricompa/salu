import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Trigger({ message }: { message: string }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast(message)}>
      Show
    </button>
  );
}

const region = () => document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("announces through a polite status region and goes away on its own", () => {
    render(
      <ToastProvider duration={5_000}>
        <Trigger message="Accepted A4's order." />
      </ToastProvider>,
    );
    expect(region()).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(region()).toHaveTextContent("Accepted A4's order.");

    act(() => void vi.advanceTimersByTime(4_999));
    expect(region()).toHaveTextContent("Accepted A4's order.");
    act(() => void vi.advanceTimersByTime(1));
    expect(region()).toBeEmptyDOMElement();
  });

  it("holds while hovered, and can be dismissed", () => {
    render(
      <ToastProvider duration={1_000}>
        <Trigger message="Seated A4." />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    const toast = screen.getByText("Seated A4.").parentElement as HTMLElement;
    fireEvent.mouseEnter(toast);
    act(() => void vi.advanceTimersByTime(5_000));
    expect(region()).toHaveTextContent("Seated A4.");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(region()).toBeEmptyDOMElement();
  });

  it("skips the entrance animation under reduced motion and keeps at most three", () => {
    render(
      <ToastProvider>
        <Trigger message="Served." />
      </ToastProvider>,
    );
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Show" }));
    const toasts = screen.getAllByText("Served.");
    expect(toasts).toHaveLength(3);
    expect(toasts[0].parentElement?.className).toContain("motion-reduce:animate-none");
  });

  it("does nothing without a provider instead of throwing", () => {
    render(<Trigger message="Nobody hears this." />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Show" }))).not.toThrow();
  });
});
