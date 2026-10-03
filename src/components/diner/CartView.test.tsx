import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cartStorageKey, saveCart } from "@/lib/cart";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { CartView } = await import("./CartView");

const salmon = {
  itemId: "s",
  name: "Grilled Salmon",
  priceCents: 2400,
  notes: "",
};
const avocado = { itemId: "a", name: "Add Avocado", priceCents: 300 };

describe("CartView add-ons", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("prices add-ons per unit and names each line's add-ons for screen readers", () => {
    saveCart(window.sessionStorage, cartStorageKey("tok", "c1"), [
      { ...salmon, quantity: 2, addons: [avocado] },
      { ...salmon, quantity: 1, addons: [] },
    ]);
    render(<CartView token="tok" sessionId="c1" currency="usd" placeOrder={vi.fn()} />);

    expect(screen.getByRole("list", { name: "Add-ons for Grilled Salmon" })).toHaveTextContent(
      "+ Add Avocado · $3.00 each",
    );
    expect(screen.getByText("$54.00")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Remove Grilled Salmon with Add Avocado" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove Grilled Salmon" })).toBeVisible();
    expect(screen.getByText("$78.00")).toBeVisible();
  });
});
