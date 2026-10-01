import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NameSheet } from "./NameSheet";

describe("NameSheet", () => {
  beforeEach(() => {
    // jsdom has no modal dialog support; the browser behaviour is covered by e2e.
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });
    window.localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("asks once per session, with Skip as big as Save", async () => {
    const save = vi.fn();
    const { unmount } = render(<NameSheet sessionId="s1" save={save} />);
    const sheet = screen.getByRole("dialog", { name: "What should we call you?" });
    const skip = screen.getByRole("button", { name: "Skip" });
    expect(skip.className).toContain("min-h-11");
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();

    await userEvent.click(skip);
    expect(sheet).not.toHaveAttribute("open");
    expect(save).not.toHaveBeenCalled();
    unmount();

    // A reload in the same session doesn't ask again; a new session does.
    render(<NameSheet sessionId="s1" save={save} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    render(<NameSheet sessionId="s2" save={save} />);
    expect(screen.getByRole("dialog", { name: "What should we call you?" })).toBeVisible();
  });

  it("saves the name, and shows the server's message when it can't", async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "invalid_input", message: "Type a name, or tap Skip." },
      })
      .mockResolvedValueOnce({ ok: true, data: null });
    render(<NameSheet sessionId="s1" save={save} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Type a name, or tap Skip.")).toBeVisible();

    await userEvent.type(screen.getByLabelText("Your name"), "Ari");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenLastCalledWith("Ari");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("still works when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<NameSheet sessionId="s1" save={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
