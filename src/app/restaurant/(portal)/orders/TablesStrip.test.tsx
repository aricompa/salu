import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ seatTableAction: vi.fn(), closeTableAction: vi.fn() }));
const { TablesStrip } = await import("./TablesStrip");

/** A table's tile, found by the label at its top (the buttons repeat it for screen readers). */
const tile = (label: string) =>
  screen.getAllByRole("listitem").find((li) => li.firstElementChild?.textContent === label)!;

describe("TablesStrip", () => {
  it("offers Seat for an unseated table and Close for a seated one", () => {
    render(
      <TablesStrip
        tables={[
          { id: "t1", label: "A1", sessionId: null },
          { id: "t2", label: "A4", sessionId: "s4" },
          { id: "t3", label: "B2", sessionId: "s2" },
        ]}
        openOrdersBySession={new Map([["s4", 2]])}
      />,
    );
    const a1 = tile("A1");
    expect(a1).toHaveTextContent("Not seated");
    expect(within(a1).getByRole("button", { name: "Seat A1" })).toBeVisible();

    const a4 = tile("A4");
    expect(a4).toHaveTextContent("Seated · 2 open orders");
    expect(within(a4).getByRole("button", { name: "Close table A4" })).toBeVisible();
    expect(tile("B2")).toHaveTextContent("Seated · No open orders");
  });

  it("names the open orders before closing, and Keep open backs out", async () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    render(
      <TablesStrip
        tables={[{ id: "t2", label: "A4", sessionId: "s4" }]}
        openOrdersBySession={new Map([["s4", 2]])}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close table A4" }));
    const dialog = screen.getByRole("dialog", {
      name: "A4 still has 2 open orders. Close anyway?",
    });
    expect(within(dialog).getByRole("button", { name: "Keep open" })).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Close table" })).toBeVisible();
  });

  it("says where to add tables when there are none", () => {
    render(<TablesStrip tables={[]} openOrdersBySession={new Map()} />);
    expect(screen.getByText("No active tables. Add them on the Tables page.")).toBeVisible();
  });
});
