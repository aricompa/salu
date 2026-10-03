import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// The real actions module pulls in server-only code; the form only needs a reference.
const saveItemAction = vi.fn();
vi.mock("./actions", () => ({ saveItemAction }));

const { ItemForm } = await import("./ItemForm");

const defaults = {
  id: "a1000000-0000-4000-8000-000000000001",
  name: "Add Patty",
  description: "",
  price: "6.00",
  categoryId: "",
  dietaryTags: [],
  isAvailable: true,
  addonOnly: false,
  goesWith: [],
};
const groups = [
  {
    id: "burgers",
    name: "Smash Burgers",
    items: [
      { id: "b1", name: "Mason Burger" },
      { id: "b2", name: "Rodeo Burger" },
    ],
  },
  { id: "sandwiches", name: "Sandwiches", items: [{ id: "s1", name: "Thick Bologna" }] },
];

const formOf = () => screen.getByRole("button", { name: "Save changes" }).closest("form")!;

describe("ItemForm add-ons", () => {
  it("shows the Goes with picker only for an add-on, and submits what's picked", async () => {
    render(<ItemForm item={defaults} categories={[]} goesWithGroups={groups} offers={[]} />);
    expect(screen.queryByRole("group", { name: "Goes with" })).toBeNull();

    await userEvent.click(screen.getByRole("checkbox", { name: "Only sold as an add-on" }));
    const picker = screen.getByRole("group", { name: "Goes with" });
    await userEvent.click(within(picker).getByRole("button", { name: "All in Smash Burgers" }));
    await userEvent.click(within(picker).getByRole("checkbox", { name: "Rodeo Burger" }));
    await userEvent.click(within(picker).getByRole("checkbox", { name: "Thick Bologna" }));

    expect(within(picker).getByText(/2 picked/)).toBeVisible();
    const data = new FormData(formOf());
    expect(data.get("addonOnly")).toBe("on");
    expect(data.getAll("goesWith")).toEqual(["b1", "s1"]);

    await userEvent.click(screen.getByRole("checkbox", { name: "Only sold as an add-on" }));
    expect(new FormData(formOf()).getAll("goesWith")).toEqual([]);
  });

  it("starts from the current links, and None clears a group", async () => {
    render(
      <ItemForm
        item={{ ...defaults, addonOnly: true, goesWith: ["b1", "b2"] }}
        categories={[]}
        goesWithGroups={groups}
        offers={[]}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Mason Burger" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "None in Smash Burgers" }));
    expect(new FormData(formOf()).getAll("goesWith")).toEqual([]);
  });

  it("shows what went wrong with the add-on fields after a failed save", async () => {
    saveItemAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "invalid_input", message: "Check the highlighted fields and try again." },
      fieldErrors: { goesWith: "Pick items from the list." },
      values: {},
    });
    render(
      <ItemForm
        item={{ ...defaults, addonOnly: true, goesWith: ["b1"] }}
        categories={[]}
        goesWithGroups={groups}
        offers={[]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const picker = await screen.findByRole("group", { name: "Goes with" });
    expect(await within(picker).findByText("Pick items from the list.")).toBeVisible();
    // The picks survive the failed save.
    expect(within(picker).getByRole("checkbox", { name: "Mason Burger" })).toBeChecked();
  });

  it("names a regular item's add-ons, and warns before it becomes one itself", async () => {
    render(
      <ItemForm
        item={{ ...defaults, name: "Mason Burger" }}
        categories={[]}
        goesWithGroups={groups}
        offers={["Add Patty", "Sub Fries or Tots"]}
      />,
    );
    expect(screen.getByText(/Add-ons offered with it: Add Patty, Sub Fries or Tots/)).toBeVisible();
    await userEvent.click(screen.getByRole("checkbox", { name: "Only sold as an add-on" }));
    expect(screen.getByText(/will stop being offered with it/)).toBeVisible();
  });
});
