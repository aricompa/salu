import { expect, test, type Browser } from "@playwright/test";
import {
  createDinerFixture,
  dinerPlacesOrder,
  ownerCookies,
  rest,
  skipNameSheet,
  type DinerFixture,
} from "./helpers";

async function ownerPage(browser: Browser, fx: DinerFixture) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await context.addCookies(await ownerCookies(fx));
  return { context, page: await context.newPage() };
}

test("before the first order, the checklist's test order opens the first table as a diner", async ({
  browser,
}) => {
  const fx = await createDinerFixture();
  const { context, page } = await ownerPage(browser, fx);
  await page.goto("/restaurant/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Get set up" })).toBeVisible();
  await expect(page.getByText("2 of 3 done")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today" })).toHaveCount(0);

  const testOrder = page.getByRole("link", { name: "Place a test order" });
  await expect(testOrder).toHaveAttribute("href", `/t/${fx.tables.A1.token}`);
  await testOrder.click();
  await expect(page).toHaveURL(new RegExp(`/t/${fx.tables.A1.token}/menu$`), { timeout: 20_000 });
  await skipNameSheet(page);
  await expect(page.getByText("Table A1")).toBeVisible();
  await context.close();
});

test("once live, the dashboard counts open tables, waiting orders and time to serve", async ({
  browser,
}) => {
  const fx = await createDinerFixture();
  const first = await dinerPlacesOrder(fx, "A1", [{ item: "Burrata" }]);
  for (const status of ["accepted", "ready", "served"]) {
    await rest(fx.ownerJwt, `orders?id=eq.${first.orderId}`, { method: "PATCH", body: { status } });
  }

  const { context, page } = await ownerPage(browser, fx);
  await page.goto("/restaurant/dashboard");
  const today = page.getByRole("region", { name: "Today" });
  await expect(today).toBeVisible();
  await expect(page.getByRole("heading", { name: "Get set up" })).toHaveCount(0);
  /** The value under a stat's label (each stat is a card holding one dt and one dd). */
  const stat = (label: string) =>
    today
      .locator("div")
      .filter({ has: page.locator("dt", { hasText: label }) })
      .locator("dd");
  await expect(stat("Open tables")).toHaveText("6");
  await expect(stat("Orders waiting")).toHaveText("0");
  await expect(stat("Average time to serve")).toHaveText("0 min");
  await expect(today).toContainText("Sent to served, 1 order today");

  // A new order shows up without a reload.
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible({
    timeout: 15_000,
  });
  await dinerPlacesOrder(fx, "B1", [{ item: "Tuna Crudo" }]);
  await expect(stat("Orders waiting")).toHaveText("1", { timeout: 5_000 });
  await context.close();
});
