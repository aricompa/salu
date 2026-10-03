import { describe, expect, it } from "vitest";
import { addonCounts, addonFormFields, shapeDinerMenu, unorderableIds } from "./menu-addons";
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

describe("addonCounts", () => {
  it("counts links that reach diners, both ways", () => {
    const items = [item("mason", "b"), item("veggie", "b"), item("patty", "a", true), item("fries", "a")];
    const { goesWith, offers } = addonCounts(items, [
      { item_id: "mason", addon_id: "patty" },
      { item_id: "veggie", addon_id: "patty" },
      { item_id: "mason", addon_id: "fries" },
    ]);
    expect([...goesWith]).toEqual([["patty", 2]]);
    expect([...offers]).toEqual([
      ["mason", 1],
      ["veggie", 1],
    ]);
  });
});

describe("addonFormFields", () => {
  const categories = [
    { id: "b", name: "Burgers", is_active: true },
    { id: "a", name: "Add-ons", is_active: true },
    { id: "s", name: "Secret", is_active: false },
  ];
  const named = (id: string, category_id: string | null, addon_only = false) => ({
    ...item(id, category_id, addon_only),
    name: id.toUpperCase(),
  });
  const items = [
    named("mason", "b"),
    named("veggie", "b"),
    named("patty", "a", true),
    named("bacon", "a", true),
    named("staff", "s"),
    named("loose", null),
  ];
  const links = [
    { item_id: "mason", addon_id: "patty" },
    { item_id: "mason", addon_id: "bacon" },
  ];

  it("lists regular items by category, marks hidden ones, and shows current links", () => {
    const fields = addonFormFields(categories, items, links, "patty");
    expect(fields.groups.map((g) => [g.name, g.items.map((i) => i.id)])).toEqual([
      ["Burgers", ["mason", "veggie"]],
      ["Secret (hidden)", ["staff"]],
      ["No category", ["loose"]],
    ]);
    expect(fields.goesWith).toEqual(["mason"]);
    expect(fields.offers).toEqual([]);
  });

  it("names the add-ons a regular item offers, and never lists the item itself", () => {
    const fields = addonFormFields(categories, items, links, "mason");
    expect(fields.offers).toEqual(["PATTY", "BACON"]);
    expect(fields.groups[0].items.map((i) => i.id)).toEqual(["veggie"]);
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
