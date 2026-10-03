import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cartStorageKey, loadCart } from "@/lib/cart";
import { MenuView, type MenuViewCategory } from "./MenuView";

const categories: MenuViewCategory[] = [
  {
    id: "c1",
    name: "Smash Burgers",
    items: [
      {
        id: "burger",
        name: "Mason Burger",
        description: null,
        price_cents: 1500,
        is_available: true,
        dietary_tags: [],
        addons: [
          { id: "patty", name: "Add Patty", price_cents: 600, is_available: true },
          { id: "fries", name: "Sub Fries or Tots", price_cents: 250, is_available: true },
          { id: "impossible", name: "Sub Impossible Patty", price_cents: 300, is_available: false },
        ],
      },
      {
        id: "veggie",
        name: "Veggie Burger",
        description: null,
        price_cents: 1700,
        is_available: true,
        dietary_tags: [],
        addons: [],
      },
    ],
  },
];

describe("MenuView add-ons", () => {
  beforeEach(() => {
    // jsdom has no modal dialog support; the browser behaviour is covered by e2e.
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });
    // Nor what the category tabs use to follow the scroll; they only need them to exist.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    Element.prototype.scrollIntoView = vi.fn();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderMenu = (sessionId: string) =>
    render(<MenuView token="tok" sessionId={sessionId} currency="usd" categories={categories} />);

  it("offers the item's add-ons in its sheet, priced, with sold-out ones disabled", async () => {
    renderMenu("s1");
    await userEvent.click(screen.getByRole("button", { name: /Mason Burger/ }));
    const sheet = screen.getByRole("dialog", { name: "Mason Burger" });
    const addons = within(sheet).getByRole("group", { name: "Add-ons" });

    expect(within(addons).getByRole("checkbox", { name: /Add Patty/ })).toBeEnabled();
    expect(within(addons).getByText("+$6.00")).toBeVisible();
    expect(within(addons).getByRole("checkbox", { name: /Sub Impossible Patty/ })).toBeDisabled();
    expect(within(addons).getByText("Sold out")).toBeVisible();
    expect(within(sheet).getByRole("button", { name: "Add · $15.00" })).toBeVisible();
  });

  it("adds the item with its add-ons, priced for every unit, as one cart line", async () => {
    renderMenu("s2");
    await userEvent.click(screen.getByRole("button", { name: /Mason Burger/ }));
    const sheet = screen.getByRole("dialog", { name: "Mason Burger" });
    await userEvent.click(within(sheet).getByRole("checkbox", { name: /Add Patty/ }));
    await userEvent.click(within(sheet).getByRole("checkbox", { name: /Sub Fries or Tots/ }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Add one Mason Burger" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Add · $47.00" }));

    const cart = loadCart(window.sessionStorage, cartStorageKey("tok", "s2"));
    expect(cart).toEqual([
      {
        itemId: "burger",
        name: "Mason Burger",
        priceCents: 1500,
        quantity: 2,
        notes: "",
        addons: [
          { itemId: "patty", name: "Add Patty", priceCents: 600 },
          { itemId: "fries", name: "Sub Fries or Tots", priceCents: 250 },
        ],
      },
    ]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Added 2 Mason Burger with Add Patty and Sub Fries or Tots.",
    );
  });

  it("stops at 10 add-ons, so the price and the cart agree", async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      id: `a${i}`,
      name: `Extra ${i + 1}`,
      price_cents: 100,
      is_available: true,
    }));
    render(
      <MenuView
        token="tok"
        sessionId="s4"
        currency="usd"
        categories={[{ ...categories[0], items: [{ ...categories[0].items[0], addons: many }] }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Mason Burger/ }));
    for (let i = 1; i <= 10; i++) {
      await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(`Extra ${i}\\b`) }));
    }
    expect(screen.getByRole("checkbox", { name: /Extra 11/ })).toBeDisabled();
    expect(screen.getByText("That's 10, the most for one item.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add · $25.00" })).toBeVisible();
    await userEvent.click(screen.getByRole("checkbox", { name: /Extra 1\b/ }));
    expect(screen.getByRole("checkbox", { name: /Extra 11/ })).toBeEnabled();
  });

  it("starts each sheet with nothing picked, and shows no add-ons for items without any", async () => {
    renderMenu("s3");
    await userEvent.click(screen.getByRole("button", { name: /Mason Burger/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Add Patty/ }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: /Mason Burger/ }));
    expect(screen.getByRole("checkbox", { name: /Add Patty/ })).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: /Veggie Burger/ }));
    expect(screen.queryByRole("group", { name: "Add-ons" })).toBeNull();
  });
});
