import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BoardOrder } from "@/lib/orders";

vi.mock("./actions", () => ({
  setOrderStatusAction: vi.fn(async () => ({ ok: true, data: null })),
}));
vi.mock("@/lib/realtime", () => ({ subscribeToRestaurantOrders: vi.fn(() => () => {}) }));
const { OrderBoard } = await import("./OrderBoard");
const { ToastProvider } = await import("@/components/ui");
const { setOrderStatusAction } = await import("./actions");

const order = (over: Partial<BoardOrder> & Pick<BoardOrder, "id" | "status">): BoardOrder => ({
  sessionId: "s1",
  tableLabel: "A4",
  dinerLabel: "Guest 1",
  notes: null,
  submittedAt: new Date().toISOString(),
  finishedAt: null,
  items: [{ id: `${over.id}-1`, name: "Grilled Salmon", quantity: 2, notes: null, addons: [] }],
  ...over,
});

const column = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name} \\d+$`) });

describe("OrderBoard", () => {
  it("puts each order in its column with one next step", () => {
    render(
      <OrderBoard
        active={[
          order({ id: "o1", status: "submitted", tableLabel: "A1", dinerLabel: "Ari" }),
          order({ id: "o2", status: "accepted", tableLabel: "A2" }),
          order({ id: "o3", status: "preparing", tableLabel: "B1" }),
          order({ id: "o4", status: "ready", tableLabel: "C1" }),
        ]}
        done={[]}
        timeZone="America/New_York"
      />,
    );
    expect(within(column("New")).getByRole("button", { name: "Accept A1, Ari" })).toBeVisible();
    expect(
      within(column("Accepted")).getByRole("button", { name: "Start preparing A2, Guest 1" }),
    ).toBeVisible();
    expect(within(column("Preparing")).getByRole("button", { name: "Mark ready B1, Guest 1" }));
    expect(within(column("Ready")).getByRole("button", { name: "Mark served C1, Guest 1" }));
  });

  it("offers Cancel only where the database allows it, behind a confirmation", async () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    render(
      <OrderBoard
        active={[
          order({ id: "o1", status: "preparing", tableLabel: "A4" }),
          order({ id: "o2", status: "ready", tableLabel: "B2" }),
        ]}
        done={[]}
        timeZone="UTC"
      />,
    );
    expect(within(column("Ready")).queryByRole("button", { name: /^Cancel/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Cancel A4, Guest 1" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel A4's order?" });
    expect(dialog).toHaveAccessibleDescription("The diner sees it was cancelled.");
    expect(within(dialog).getByRole("button", { name: "Keep order" })).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Cancel order" })).toBeVisible();
  });

  it("shows item and order notes with a label, not colour alone", () => {
    render(
      <OrderBoard
        active={[
          order({
            id: "o1",
            status: "submitted",
            notes: "Birthday",
            items: [{ id: "i1", name: "Burrata", quantity: 1, notes: "No basil", addons: [] }],
          }),
        ]}
        done={[]}
        timeZone="UTC"
      />,
    );
    expect(screen.getByText("Note:").parentElement).toHaveTextContent("Note: No basil");
    expect(screen.getByText("Order note:").parentElement).toHaveTextContent("Order note: Birthday");
  });

  it("lists add-ons under the item they go with", () => {
    render(
      <OrderBoard
        active={[
          order({
            id: "o1",
            status: "submitted",
            items: [
              { id: "i1", name: "Mason Burger", quantity: 1, notes: null, addons: [] },
              {
                id: "i2",
                name: "Mason Burger",
                quantity: 1,
                notes: null,
                addons: [{ id: "a1", name: "Add Patty" }],
              },
            ],
          }),
        ]}
        done={[]}
        timeZone="UTC"
      />,
    );
    const addons = screen.getByRole("list", { name: "Add-ons for Mason Burger" });
    expect(addons).toHaveTextContent("+ Add Patty");
    expect(addons.closest("li")).toHaveTextContent("1 × Mason Burger+ Add Patty");
    expect(screen.getAllByText("Mason Burger", { exact: false })).toHaveLength(2);
  });

  it("says when a column is empty, and lists today's finished orders in the drawer", () => {
    render(
      <OrderBoard
        active={[]}
        done={[
          order({
            id: "o1",
            status: "served",
            tableLabel: "A1",
            finishedAt: "2026-09-29T23:42:00Z",
          }),
          order({ id: "o2", status: "cancelled", tableLabel: "A2", finishedAt: null }),
        ]}
        timeZone="America/New_York"
      />,
    );
    expect(within(column("New")).getByText("No new orders.")).toBeVisible();
    expect(screen.getByText("Done today · 2")).toBeVisible();
    const served = screen.getByText("Served").closest("li") as HTMLElement;
    expect(served).toHaveTextContent("A1");
    expect(served).toHaveTextContent("2 items");
    expect(served).toHaveTextContent("7:42 PM");
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("confirms a step with a toast once the server says it's done", async () => {
    render(
      <ToastProvider>
        <OrderBoard
          active={[order({ id: "o1", status: "submitted", tableLabel: "A1", dinerLabel: "Ari" })]}
          done={[]}
          timeZone="UTC"
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Accept A1, Ari" }));
    expect(await screen.findByText("Accepted A1's order.")).toBeVisible();
    const [, formData] = vi.mocked(setOrderStatusAction).mock.lastCall as unknown as [
      unknown,
      FormData,
    ];
    expect(Object.fromEntries(formData)).toEqual({ id: "o1", to: "accepted" });
  });
});
