import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Turnstile } from "./Turnstile";

// The real script comes from Cloudflare; with window.turnstile present the component skips
// loading it, so these tests drive the widget API directly.
const rendered = () => vi.waitFor(() => expect(api.render).toHaveBeenCalledOnce());

type Options = Record<string, (arg?: string) => void> & { sitekey?: unknown };
const api = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };

describe("Turnstile", () => {
  let options: Options;

  beforeEach(() => {
    api.render.mockImplementation((_el: HTMLElement, o: Options) => {
      options = o;
      return "widget-1";
    });
    window.turnstile = api as never;
  });
  afterEach(() => {
    vi.clearAllMocks();
    delete window.turnstile;
  });

  it("renders with the site key and hands over a token", async () => {
    const onToken = vi.fn();
    render(<Turnstile siteKey="1x00000000000000000000AA" onToken={onToken} action="sign-in" />);
    await rendered();
    expect(options.sitekey).toBe("1x00000000000000000000AA");
    act(() => options.callback("tok"));
    expect(onToken).toHaveBeenLastCalledWith("tok");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("never dead-ends: a failure explains itself and offers a retry", async () => {
    const onToken = vi.fn();
    render(<Turnstile siteKey="k" onToken={onToken} />);
    await rendered();
    act(() => options["error-callback"]());
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't check this device.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(api.reset).toHaveBeenCalledWith("widget-1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("treats a timeout like a failure and an expired token as no token", async () => {
    const onToken = vi.fn();
    render(<Turnstile siteKey="k" onToken={onToken} />);
    await rendered();
    act(() => options["expired-callback"]());
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(api.reset).toHaveBeenCalledWith("widget-1");
    act(() => options["timeout-callback"]());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("reports a script that fails to load, and a retry loads it again", async () => {
    delete window.turnstile;
    const onToken = vi.fn();
    render(<Turnstile siteKey="k" onToken={onToken} />);
    const script = () => document.head.querySelector<HTMLScriptElement>("script[src*='turnstile']");
    await vi.waitFor(() => expect(script()).not.toBeNull());
    act(() => void script()!.onerror!(new Event("error")));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't check this device.");
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(script()).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await vi.waitFor(() => expect(script()).not.toBeNull());
  });

  it("removes its widget on unmount", async () => {
    const { unmount } = render(<Turnstile siteKey="k" onToken={vi.fn()} />);
    await rendered();
    unmount();
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });
});
