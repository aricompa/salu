import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MenuCategory, MenuItem } from "@/lib/menu";

// The real actions module pulls in server-only code; the board only needs references.
vi.mock("./actions", () => ({
  deleteCategoryAction: vi.fn(),
  deleteItemAction: vi.fn(),
  moveCategoryAction: vi.fn(),
  moveItemAction: vi.fn(),
  setCategoryVisibleAction: vi.fn(),
  renameCategoryAction: vi.fn(),
  setItemAvailabilityAction: vi.fn(),
}));
vi.mock("@/lib/menu", () => ({}));

const { MenuBoard } = await import("./MenuBoard");

const categories: MenuCategory[] = [
  { id: "c1000000-0000-4000-8000-000000000001", name: "Mains", sort_order: 0, is_active: true },
  { id: "c2000000-0000-4000-8000-000000000002", name: "Drinks", sort_order: 1, is_active: false },
];
const items: MenuItem[] = [
  {
    id: "i1000000-0000-4000-8000-000000000001",
    category_id: categories[0].id,
    name: "Lobster Roll",
    description: "Butter-toasted bun.",
    price_cents: 3200,
    is_available: false,
    dietary_tags: ["gluten-free"],
    sort_order: 0,
  },
  {
    id: "i2000000-0000-4000-8000-000000000002",
    category_id: null,
    name: "Mystery Soup",
    description: null,
    price_cents: 900,
    is_available: true,
    dietary_tags: [],
    sort_order: 0,
  },
];

describe("MenuBoard", () => {
  it("shows prices, tags as text, sold-out as text, and hidden and uncategorised groups", () => {
    render(<MenuBoard categories={categories} items={items} manage currency="usd" />);
    expect(screen.getByText("$32.00")).toBeInTheDocument();
    expect(screen.getByText("Gluten-free")).toBeInTheDocument();
    expect(screen.getByText("Sold out")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No category" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Available Lobster Roll" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("gives owners and managers the editing controls, with delete blocked on a non-empty category", () => {
    render(<MenuBoard categories={categories} items={items} manage currency="usd" />);
    expect(screen.getByRole("button", { name: "Rename Mains" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Lobster Roll" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Mains" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Drinks" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move up Mains" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down Drinks" })).toBeDisabled();
  });

  it("gives floor staff the 86 switch and nothing else", () => {
    render(<MenuBoard categories={categories} items={items} manage={false} currency="usd" />);
    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getAllByRole("switch")).toHaveLength(2);
    const soup = screen.getByRole("switch", { name: "Available Mystery Soup" });
    expect(within(soup).getByText("Available")).toBeInTheDocument();
  });
});
