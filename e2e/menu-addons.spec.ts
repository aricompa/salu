import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  createDinerFixture,
  ownerCookies,
  rest,
  skipNameSheet,
  type DinerFixture,
} from "./helpers";

// Linked add-ons (ruled 2026-10-03): picked inside the item, priced by the database,
// nested under their item on the kitchen board.
let fx: DinerFixture;
const addon: Record<string, string> = {};

test.beforeAll(async () => {
  fx = await createDinerFixture();
  const [mains] = await rest<Array<{ id: string }>>(
    fx.ownerJwt,
    `menu_categories?restaurant_id=eq.${fx.restaurantId}&name=eq.Mains&select=id`,
  );
  const rows = await rest<Array<{ id: string; name: string }>>(fx.ownerJwt, "menu_items", {
    method: "POST",
    prefer: "return=representation",
    body: [
      ["Add Avocado", 300],
      ["Add Chili Oil", 150],
    ].map(([name, price_cents], i) => ({
      restaurant_id: fx.restaurantId,
      category_id: mains.id,
      name,
      price_cents,
      addon_only: true,
      sort_order: 10 + i,
    })),
  });
  for (const row of rows) addon[row.name] = row.id;
  await rest(fx.ownerJwt, "menu_item_addons", {
    method: "POST",
    body: {
      restaurant_id: fx.restaurantId,
      item_id: fx.items["Grilled Salmon"],
      addon_id: addon["Add Avocado"],
    },
  });
});

async function openPhone(browser: Browser, label: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`/t/${fx.tables[label].token}`);
  await expect(page).toHaveURL(/\/menu$/, { timeout: 20_000 });
  await skipNameSheet(page);
  return { context, page };
}

async function openStaff(browser: Browser, path: string) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await context.addCookies(await ownerCookies(fx));
  const page = await context.newPage();
  await page.goto(path);
  return { context, page };
}

async function addSalmon(page: Page, withAvocado: boolean, quantity = 1) {
  await page.getByRole("button", { name: /Grilled Salmon/ }).click();
  const sheet = page.getByRole("dialog", { name: "Grilled Salmon" });
  if (withAvocado) await sheet.getByRole("checkbox", { name: /Add Avocado/ }).check();
  for (let i = 1; i < quantity; i++) {
    await sheet.getByRole("button", { name: "Add one Grilled Salmon" }).click();
  }
  await sheet.getByRole("button", { name: /^Add ·/ }).click();
  await expect(sheet).toBeHidden();
}

test("a diner picks an add-on inside its item, and the kitchen sees it under that item", async ({
  browser,
}) => {
  const board = await openStaff(browser, "/restaurant/orders");
  await expect(board.page.getByRole("status").filter({ hasText: "Live" })).toBeVisible({
    timeout: 15_000,
  });
  const { context, page } = await openPhone(browser, "C1");

  // No separate add-ons section: they live inside the item.
  await expect(
    page.getByRole("navigation", { name: "Menu sections" }).getByRole("link"),
  ).toHaveText(["Starters", "Mains"]);
  await expect(page.getByText("Add Avocado")).toHaveCount(0);

  await page.getByRole("button", { name: /Grilled Salmon/ }).click();
  const sheet = page.getByRole("dialog", { name: "Grilled Salmon" });
  const addons = sheet.getByRole("group", { name: "Add-ons" });
  await expect(addons.getByRole("checkbox")).toHaveCount(1);
  await expect(addons).toContainText("Add Avocado+$3.00");
  await addons.getByRole("checkbox", { name: /Add Avocado/ }).check();
  await sheet.getByRole("button", { name: "Add one Grilled Salmon" }).click();
  await expect(sheet.getByRole("button", { name: "Add · $54.00" })).toBeVisible();
  await page.screenshot({ path: "test-results/addons-sheet-390.png" });
  await sheet.getByRole("button", { name: "Add · $54.00" }).click();
  await expect(sheet).toBeHidden();
  await addSalmon(page, false);
  await expect(page.getByRole("link", { name: /3 items · \$78\.00/ })).toBeVisible();

  await page.getByRole("link", { name: /View order/ }).click();
  await expect(page.getByRole("list", { name: "Add-ons for Grilled Salmon" })).toHaveText(
    "+ Add Avocado · $3.00",
  );
  await expect(page.getByText("$54.00")).toBeVisible();
  await page.screenshot({ path: "test-results/addons-cart-390.png" });
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderId = page.url().split("/").pop();

  // The database priced it: (24 + 3) x 2 + 24.
  const [order] = await rest<Array<{ subtotal_cents: number }>>(
    fx.ownerJwt,
    `orders?id=eq.${orderId}&select=subtotal_cents`,
  );
  expect(order.subtotal_cents).toBe(7800);
  const lines = await rest<
    Array<{ id: string; parent_id: string | null; item_name: string; quantity: number }>
  >(fx.ownerJwt, `order_items?order_id=eq.${orderId}&select=id,parent_id,item_name,quantity`);
  const avocado = lines.find((l) => l.item_name === "Add Avocado")!;
  expect(avocado.quantity).toBe(2);
  expect(lines.find((l) => l.id === avocado.parent_id)).toMatchObject({
    item_name: "Grilled Salmon",
    quantity: 2,
  });

  await expect(page.getByText("+ Add Avocado")).toBeVisible();

  const card = board.page.getByRole("article", { name: "C1" });
  await expect(card).toBeVisible({ timeout: 5_000 });
  const nested = card.getByRole("list", { name: "Add-ons for Grilled Salmon" });
  await expect(nested).toHaveText("+ Add Avocado");
  await expect(nested.locator("xpath=..")).toContainText("2 × Grilled Salmon");
  await expect(card.getByRole("listitem").filter({ hasText: /^1 × Grilled Salmon$/ })).toHaveCount(
    1,
  );
  await board.page.screenshot({ path: "test-results/addons-board-1024.png" });

  await context.close();
  await board.context.close();
});

test("a sold-out add-on comes off the order and its item stays", async ({ browser }) => {
  const { context, page } = await openPhone(browser, "C2");
  await addSalmon(page, true);
  await page.getByRole("link", { name: /View order/ }).click();

  // The kitchen runs out of avocado while it sits in the cart.
  await rest(fx.ownerJwt, "rpc/set_item_availability", {
    method: "POST",
    body: { p_item_id: addon["Add Avocado"], p_available: false },
  });
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Sorry, Add Avocado just sold out." }),
  ).toHaveText("Sorry, Add Avocado just sold out. We took it off your order.");
  await expect(page.getByRole("button", { name: "Remove Grilled Salmon" })).toHaveCount(1);
  await expect(page.getByRole("list", { name: "Add-ons for Grilled Salmon" })).toHaveCount(0);
  await expect(page.getByText("$24.00").first()).toBeVisible();

  // On the menu it shows as sold out, and can't be picked.
  await page.goto(`/t/${fx.tables.C2.token}/menu`);
  await page.getByRole("button", { name: /Grilled Salmon/ }).click();
  await expect(page.getByRole("checkbox", { name: /Add Avocado/ })).toBeDisabled();
  await rest(fx.ownerJwt, "rpc/set_item_availability", {
    method: "POST",
    body: { p_item_id: addon["Add Avocado"], p_available: true },
  });
  await context.close();
});

test("an owner links an add-on from its edit page, and diners see it on that item", async ({
  browser,
}) => {
  const staff = await openStaff(browser, "/restaurant/menu");
  // Category rows hold item rows; the innermost match is the item's own row.
  const row = (name: string) =>
    staff.page
      .getByRole("listitem")
      .filter({ has: staff.page.getByText(name, { exact: true }) })
      .last();
  await expect(row("Add Chili Oil")).toContainText("Not offered yet");
  await expect(row("Grilled Salmon")).toContainText("1 add-on");

  await staff.page.getByRole("link", { name: "Edit Add Chili Oil" }).click();
  await expect(staff.page.getByRole("checkbox", { name: "Only sold as an add-on" })).toBeChecked();
  const picker = staff.page.getByRole("group", { name: "Goes with" });
  await expect(picker.getByRole("checkbox", { name: "Lobster Roll" })).toBeVisible();
  await expect(picker.getByRole("checkbox", { name: "Add Avocado" })).toHaveCount(0);
  await picker.getByRole("checkbox", { name: "Burrata" }).check();
  await staff.page.screenshot({ path: "test-results/addons-item-form-1024.png", fullPage: true });
  await staff.page.getByRole("button", { name: "Save changes" }).click();
  await expect(staff.page).toHaveURL(/\/restaurant\/menu$/);
  await expect(row("Add Chili Oil")).toContainText("Offered with 1 item");
  await expect(row("Burrata")).toContainText("1 add-on");

  const { context, page } = await openPhone(browser, "D1");
  await page.getByRole("button", { name: /Burrata/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Burrata" }).getByRole("group", { name: "Add-ons" }),
  ).toContainText("Add Chili Oil+$1.50");

  await context.close();
  await staff.context.close();
});
