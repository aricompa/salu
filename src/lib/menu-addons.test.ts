import { describe, expect, it } from "vitest";
import { shapeDinerMenu, unorderableIds } from "./menu-addons";
import { nestLines } from "./order-lines";

const item = (id: string, category_id: string | null, addon_only = false) => ({
  id,
  category_id,
  addon_only,
});

describe("shapeDinerMenu", () => {
  const categories = [{ id: "burgers" }, { id: "addons" }];
  const items = [
    item("mason", "burgers"),
    item("veggie", "burgers"),
    item("bacon", "addons", true),
    item("patty", "addons", true),
    item("truffle", "hidden-category", true),
    item("fries", "addons"),
  ];

  it("offers linked add-on-only items under their item, in menu order, never on their own", () => {
    const menu = shapeDinerMenu(categories, items, [
      { item_id: "mason", addon_id: "patty" },
      { item_id: "mason", addon_id: "bacon" },
    ]);
    expect(menu.map((c) => [c.id, c.items.map((i) => i.id)])).toEqual([
      ["burgers", ["mason", "veggie"]],
      ["addons", ["fries"]],
    ]);
    expect(menu[0].items[0].addons.map((a) => a.id)).toEqual(["bacon", "patty"]);
    expect(menu[0].items[1].addons).toEqual([]);
  });

  it("ignores links place_order would refuse: hidden category, not add-on-only", () => {
    const menu = shapeDinerMenu(categories, items, [
      { item_id: "mason", addon_id: "truffle" },
      { item_id: "mason", addon_id: "fries" },
    ]);
    expect(menu[0].items[0].addons).toEqual([]);
  });

  it("drops a category left with only add-ons, as the Add-ons section disappears", () => {
    const menu = shapeDinerMenu(categories, items.slice(0, 4), []);
    expect(menu.map((c) => c.id)).toEqual(["burgers"]);
  });
});

describe("unorderableIds", () => {
  // available, in an active category: false = a regular item, true = add-on-only
  const orderable = new Map([
    ["mason", false],
    ["patty", true],
    ["fries", false],
  ]);
  const links = [{ item_id: "mason", addon_id: "patty" }];

  it("names nothing when every line and add-on can be ordered", () => {
    expect(unorderableIds([{ itemId: "mason", addonIds: ["patty"] }], orderable, links)).toEqual([]);
  });

  it("names a gone item, an add-on-only item on its own, and add-ons that are gone or unlinked", () => {
    expect(
      unorderableIds(
        [
          { itemId: "lobster", addonIds: [] },
          { itemId: "patty", addonIds: [] },
          { itemId: "mason", addonIds: ["bacon", "fries"] },
          { itemId: "fries", addonIds: ["patty"] },
        ],
        orderable,
        links,
      ),
    ).toEqual(["lobster", "patty", "bacon", "fries"]);
  });
});

describe("nestLines", () => {
  const row = (id: string, parent_id: string | null) => ({ id, parent_id });

  it("puts each add-on under its line, whatever order the rows come in", () => {
    const lines = nestLines([row("a1", "b"), row("b", null), row("c", null), row("a2", "b")]);
    expect(lines.map((l) => [l.id, l.addons.map((a) => a.id)])).toEqual([
      ["b", ["a1", "a2"]],
      ["c", []],
    ]);
  });

  it("still shows an add-on whose line is missing", () => {
    expect(nestLines([row("a", "gone")]).map((l) => l.id)).toEqual(["a"]);
  });
});
