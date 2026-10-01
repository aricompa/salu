import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  createDinerFixture,
  dinerPlacesOrder,
  ownerCookies,
  rest,
  type DinerFixture,
} from "./helpers";

let fx: DinerFixture;
test.beforeAll(async () => {
  fx = await createDinerFixture();
});

/** The owner's board in its own browser, as a tablet at the pass would have it. */
async function openBoard(browser: Browser, options: { realtime?: boolean } = {}) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await context.addCookies(await ownerCookies(fx));
  const page = await context.newPage();
  // With realtime off, the board can only learn about changes by re-rendering.
  if (options.realtime === false) await page.routeWebSocket(/\/realtime\/v1\/websocket/, () => {});
  await page.goto("/restaurant/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  return { context, page };
}

const column = (page: Page, name: string) =>
  page.getByRole("region", { name: new RegExp(`^${name} \\d+$`) });

async function storedStatus(orderId: string) {
  const [row] = await rest<Array<{ status: string }>>(
    fx.ownerJwt,
    `orders?id=eq.${orderId}&select=status`,
  );
  return row.status;
}

test("a new order appears without a reload and moves one column per tap", async ({ browser }) => {
  const { context, page } = await openBoard(browser);
  // The Brief 03 race: an order placed before the change feed is ready would be missed.
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible({
    timeout: 15_000,
  });

  const { orderId } = await dinerPlacesOrder(
    fx,
    "A1",
    [{ item: "Grilled Salmon", quantity: 2, notes: "No capers" }],
    { name: "Ari", notes: "Birthday" },
  );
  const card = column(page, "New").getByRole("article", { name: "A1" });
  await expect(card).toBeVisible({ timeout: 5_000 });
  await expect(card).toContainText("Ari");
  await expect(card).toContainText("2 × Grilled Salmon");
  await expect(card).toContainText("Note: No capers");
  await expect(card).toContainText("Order note: Birthday");
  await expect(card).toContainText("Just now");
  await expect(page.getByText("New order for A1.")).toBeAttached();

  for (const [button, next] of [
    ["Accept", "Accepted"],
    ["Start preparing", "Preparing"],
    ["Mark ready", "Ready"],
  ] as const) {
    await page.getByRole("button", { name: `${button} A1, Ari` }).click();
    await expect(column(page, next).getByRole("article", { name: "A1" })).toBeVisible();
  }
  await expect(column(page, "Ready").getByRole("button", { name: "Cancel A1, Ari" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Mark served A1, Ari" }).click();
  await expect(page.getByRole("article", { name: "A1" })).toHaveCount(0);
  await page.getByText(/^Done today · \d+$/).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Served" })).toContainText("A1");
  expect(await storedStatus(orderId)).toBe("served");
  await context.close();
});

test("cancel asks first, and Keep order leaves it alone", async ({ browser }) => {
  const { orderId } = await dinerPlacesOrder(fx, "A2", [{ item: "Burrata" }]);
  const { context, page } = await openBoard(browser);
  const card = column(page, "New").getByRole("article", { name: "A2" });
  await expect(card).toBeVisible();

  await page.getByRole("button", { name: "Cancel A2, Guest 1" }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel A2's order?" });
  await expect(dialog).toContainText("The diner sees it was cancelled.");
  await dialog.getByRole("button", { name: "Keep order" }).click();
  await expect(dialog).toBeHidden();
  await expect(card).toBeVisible();
  expect(await storedStatus(orderId)).toBe("submitted");

  await page.getByRole("button", { name: "Cancel A2, Guest 1" }).click();
  await dialog.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByRole("article", { name: "A2" })).toHaveCount(0);
  await page.getByText(/^Done today · \d+$/).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Cancelled" })).toContainText("A2");
  expect(await storedStatus(orderId)).toBe("cancelled");
  await context.close();
});

test("a stale action says the order already moved on", async ({ browser }) => {
  const { orderId } = await dinerPlacesOrder(fx, "C1", [{ item: "Tuna Crudo" }]);
  // Realtime off, so the card stays stale after another device cancels the order.
  const { context, page } = await openBoard(browser, { realtime: false });
  await expect(column(page, "New").getByRole("article", { name: "C1" })).toBeVisible();

  await rest(fx.ownerJwt, `orders?id=eq.${orderId}`, {
    method: "PATCH",
    body: { status: "cancelled" },
  });
  await page.getByRole("button", { name: "Accept C1, Guest 1" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already moved on" })).toHaveText(
    "That order already moved on. Refresh to see where it is.",
  );
  expect(await storedStatus(orderId)).toBe("cancelled");
  await context.close();
});
