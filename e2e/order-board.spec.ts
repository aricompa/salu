import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  addUnseatedTable,
  createDinerFixture,
  dinerPlacesOrder,
  ownerCookies,
  rest,
  seatTable,
  skipNameSheet,
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

test("a table takes orders only once staff seat it, and must be seated again after closing", async ({
  browser,
}) => {
  const { token } = await addUnseatedTable(fx, "E1");
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const diner = await phone.newPage();
  await diner.goto(`/t/${token}`);
  await expect(diner.getByRole("heading", { name: "Your table isn't open yet" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(diner.getByText("Ask your server to seat you, then scan again.")).toBeVisible();

  const { context, page } = await openBoard(browser);
  const tile = page
    .getByRole("region", { name: "Tables" })
    .getByRole("listitem")
    .filter({ has: page.getByText("E1", { exact: true }) });
  await expect(tile).toContainText("Not seated");
  await page.getByRole("button", { name: "Seat E1" }).click();
  await expect(tile).toContainText("Seated · No open orders");
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible({
    timeout: 15_000,
  });

  // The same phone scans again and orders.
  await diner.getByRole("link", { name: "Scan again" }).click();
  await expect(diner).toHaveURL(/\/menu$/);
  await skipNameSheet(diner);
  for (let i = 0; i < 2; i++) {
    await diner.getByRole("button", { name: /Burrata/ }).click();
    await diner
      .getByRole("dialog", { name: "Burrata" })
      .getByRole("button", { name: /^Add ·/ })
      .click();
    await expect(diner.getByRole("dialog", { name: "Burrata" })).toBeHidden();
    if (i === 0) {
      await diner.getByRole("link", { name: /View order/ }).click();
      await diner.getByRole("button", { name: "Place order" }).click();
      await expect(diner).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
      await expect(column(page, "New").getByRole("article", { name: "E1" })).toBeVisible();
      await expect(tile).toContainText("Seated · 1 open order");
      await diner.getByRole("link", { name: "Order more" }).click();
    }
  }
  await diner.getByRole("link", { name: /View order/ }).click();
  await expect(diner.getByRole("heading", { name: "Your order" })).toBeVisible();

  // Staff close the table while the diner has a second order in the cart.
  await page.getByRole("button", { name: "Close table E1" }).click();
  const confirm = page.getByRole("dialog", { name: "E1 still has 1 open order. Close anyway?" });
  await confirm.getByRole("button", { name: "Close table" }).click();
  await expect(tile).toContainText("Not seated");
  await expect(column(page, "New").getByRole("article", { name: "E1" })).toBeVisible();

  await diner.getByRole("button", { name: "Place order" }).click();
  await expect(
    diner.getByRole("alert").filter({ hasText: "This table was closed." }),
  ).toBeVisible();
  await diner.getByRole("link", { name: "Start a new tab" }).click();
  await expect(diner.getByRole("heading", { name: "Your table isn't open yet" })).toBeVisible();
  await phone.close();
  await context.close();
});

test("diners name themselves or skip, and the board labels them", async ({ browser }) => {
  const { token } = await addUnseatedTable(fx, "F1");
  await seatTable(fx, "F1");
  const { context, page } = await openBoard(browser);
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible({
    timeout: 15_000,
  });

  /** One phone at F1: scan, answer the name sheet, order one dish. */
  const order = async (dish: string, name: string | null) => {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const diner = await phone.newPage();
    await diner.goto(`/t/${token}`);
    await expect(diner).toHaveURL(/\/menu$/, { timeout: 20_000 });
    const sheet = diner.getByRole("dialog", { name: "What should we call you?" });
    if (name === null) {
      await skipNameSheet(diner);
    } else {
      await sheet.getByLabel("Your name").fill(name);
      await sheet.getByRole("button", { name: "Save" }).click();
      await expect(sheet).toBeHidden();
    }
    // A reload in the same session doesn't ask again.
    await diner.reload();
    await expect(diner.getByRole("heading", { level: 1, name: "Casa Grande" })).toBeVisible();
    await expect(sheet).toBeHidden();

    await diner.getByRole("button", { name: new RegExp(dish) }).click();
    await diner
      .getByRole("dialog", { name: dish })
      .getByRole("button", { name: /^Add ·/ })
      .click();
    await diner.getByRole("link", { name: /View order/ }).click();
    await diner.getByRole("button", { name: "Place order" }).click();
    await expect(diner).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
    await phone.close();
  };

  await order("Tuna Crudo", null); // joins first: Guest 1
  await order("Burrata", "Bea");
  const cards = column(page, "New").getByRole("article", { name: "F1" });
  await expect(cards.filter({ hasText: "Tuna Crudo" })).toContainText("Guest 1");
  await expect(cards.filter({ hasText: "Burrata" })).toContainText("Bea");
  await context.close();
});

test("happy path: a diner names themselves and orders, staff move it along, the phone follows live", async ({
  browser,
}) => {
  const { token } = await addUnseatedTable(fx, "G1");
  await seatTable(fx, "G1");
  const { context, page } = await openBoard(browser);
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible({
    timeout: 15_000,
  });

  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await phoneContext.newPage();
  await phone.goto(`/t/${token}`);
  await expect(phone).toHaveURL(/\/menu$/, { timeout: 20_000 });
  const sheet = phone.getByRole("dialog", { name: "What should we call you?" });
  await sheet.getByLabel("Your name").fill("Ari");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await phone.getByRole("button", { name: /Grilled Salmon/ }).click();
  await phone
    .getByRole("dialog", { name: "Grilled Salmon" })
    .getByRole("button", { name: /^Add ·/ })
    .click();
  await phone.getByRole("link", { name: /View order/ }).click();
  await phone.getByRole("button", { name: "Place order" }).click();
  await expect(phone).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  await expect(phone.getByText("Live: this page updates on its own.")).toBeVisible({
    timeout: 15_000,
  });

  const card = column(page, "New").getByRole("article", { name: "G1" });
  await expect(card).toContainText("Ari");
  await expect(card).toContainText("1 × Grilled Salmon");

  const heading = (name: string) => phone.getByRole("heading", { name });
  await page.getByRole("button", { name: "Accept G1, Ari" }).click();
  await expect(heading("Accepted. Your food is on its way to being made.")).toBeVisible();
  await page.getByRole("button", { name: "Start preparing G1, Ari" }).click();
  await expect(heading("Preparing. It's being made now.")).toBeVisible();
  // Ready is for staff: the phone stays on Preparing until it's served.
  await page.getByRole("button", { name: "Mark ready G1, Ari" }).click();
  await expect(column(page, "Ready").getByRole("article", { name: "G1" })).toBeVisible();
  await expect(phone.getByRole("listitem").filter({ hasText: "Preparing" })).toContainText("Now");
  await page.getByRole("button", { name: "Mark served G1, Ari" }).click();
  await expect(heading("Served. Enjoy!")).toBeVisible();

  await phoneContext.close();
  await context.close();
});
