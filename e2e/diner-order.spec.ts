import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  addUnseatedTable,
  PUBLISHABLE_KEY,
  SUPABASE_URL,
  TEST_CAPTCHA_TOKEN,
  createDinerFixture,
  rest,
  seatTable,
  skipNameSheet,
  type DinerFixture,
} from "./helpers";

let fx: DinerFixture;
test.beforeAll(async () => {
  fx = await createDinerFixture();
});

test("a fresh phone scans, passes the device check and lands on the menu", async ({ page }) => {
  const { token } = fx.tables.A1;
  await page.goto(`/t/${token}`);
  await expect(page).toHaveURL(new RegExp(`/t/${token}/menu$`), { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Casa Grande" })).toBeVisible();
  await expect(page.getByText("Table A1")).toBeVisible();

  // The table cookie survived the redirect and is scoped to this table's pages.
  const cookie = (await page.context().cookies()).find((c) => c.name === "salu_table");
  expect(cookie?.path).toBe(`/t/${token}`);
  expect(cookie?.httpOnly).toBe(true);

  // A rescan on the same device skips the welcome page.
  await page.goto(`/t/${token}`);
  await expect(page).toHaveURL(new RegExp(`/t/${token}/menu$`));
});

test("unknown, rotated and deactivated codes say the table isn't active", async ({ page }) => {
  const inactive = page.getByRole("heading", { name: "This table code isn't active" });
  await page.goto(`/t/${"0".repeat(32)}`);
  await expect(inactive).toBeVisible({ timeout: 20_000 });
  await page.goto("/t/not-a-token");
  await expect(inactive).toBeVisible();

  const oldToken = fx.tables.A2.token;
  await rest(fx.ownerJwt, "rpc/rotate_table_qr", {
    method: "POST",
    body: { p_table_id: fx.tables.A2.id },
  });
  await page.goto(`/t/${oldToken}`);
  await expect(inactive).toBeVisible();

  await rest(fx.ownerJwt, `dining_tables?id=eq.${fx.tables.B1.id}`, {
    method: "PATCH",
    body: { is_active: false },
  });
  await page.goto(`/t/${fx.tables.B1.token}`);
  await expect(inactive).toBeVisible();
});

test("opening an inner page without scanning asks for a scan", async ({ page }) => {
  await page.goto(`/t/${fx.tables.A1.token}/menu`);
  await expect(page.getByRole("heading", { name: "Scan the code on your table" })).toBeVisible();
});

test("the menu shows active sections only, sold-out items can't be added, the sheet adds to the cart", async ({
  page,
}) => {
  const { token } = fx.tables.C1;
  await page.goto(`/t/${token}`);
  await expect(page).toHaveURL(new RegExp(`/menu$`), { timeout: 20_000 });
  await skipNameSheet(page);

  await expect(
    page.getByRole("navigation", { name: "Menu sections" }).getByRole("link"),
  ).toHaveText(["Starters", "Mains"]);
  await expect(page.getByText("Secret Burger")).toHaveCount(0);
  await expect(page.getByText("Sold out", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Lobster Roll/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Grilled Salmon/ }).click();
  const sheet = page.getByRole("dialog", { name: "Grilled Salmon" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Add one Grilled Salmon" }).click();
  await sheet.getByLabel("Notes for the kitchen").fill("No capers");
  await sheet.getByRole("button", { name: "Add · $48.00" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("link", { name: /2 items · \$48\.00/ })).toBeVisible();

  // The cart survives a reload (sessionStorage, per table session).
  await page.reload();
  await expect(page.getByRole("link", { name: /2 items · \$48\.00/ })).toBeVisible();
});

async function scanAndAdd(page: import("@playwright/test").Page, label: string, items: string[]) {
  const { token } = fx.tables[label];
  await page.goto(`/t/${token}`);
  await expect(page).toHaveURL(/\/menu$/, { timeout: 20_000 });
  await skipNameSheet(page);
  for (const name of items) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page
      .getByRole("dialog", { name })
      .getByRole("button", { name: /^Add ·/ })
      .click();
    await expect(page.getByRole("dialog", { name })).toBeHidden();
  }
  await page.getByRole("link", { name: /View order/ }).click();
  await expect(page.getByRole("heading", { name: "Your order" })).toBeVisible();
  return token;
}

test("placing an order: the database prices it, and a sold-out item is named and removed", async ({
  page,
}) => {
  await scanAndAdd(page, "C2", ["Burrata", "Grilled Salmon"]);
  await page.getByRole("button", { name: "Add one Grilled Salmon" }).click();
  await expect(page.getByText("$62.00")).toBeVisible(); // 14 + 2 x 24, display only

  // The kitchen 86s the burrata while it sits in the cart.
  await rest(fx.ownerJwt, `menu_items?id=eq.${fx.items.Burrata}`, {
    method: "PATCH",
    body: { is_available: false },
  });
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Sorry, Burrata just sold out." }),
  ).toHaveText("Sorry, Burrata just sold out. We took it off your order.");
  await expect(page.getByRole("listitem").filter({ hasText: "Burrata" })).toHaveCount(0);
  await rest(fx.ownerJwt, `menu_items?id=eq.${fx.items.Burrata}`, {
    method: "PATCH",
    body: { is_available: true },
  });

  await page.getByLabel("Notes for your order").fill("Celebrating a birthday");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderId = page.url().split("/").pop();
  const [order] = await rest<Array<{ subtotal_cents: number; notes: string; status: string }>>(
    fx.ownerJwt,
    `orders?id=eq.${orderId}&select=subtotal_cents,notes,status`,
  );
  expect(order).toEqual({
    subtotal_cents: 4800,
    notes: "Celebrating a birthday",
    status: "submitted",
  });

  // The status page is live: staff changes arrive without a reload.
  await expect(
    page.getByRole("heading", { name: "Your order's in. The kitchen has it." }),
  ).toBeVisible();
  await expect(page.getByText("2 × Grilled Salmon")).toBeVisible();
  await expect(page.getByText("Live: this page updates on its own.")).toBeVisible({
    timeout: 15_000,
  });
  for (const [status, copy] of [
    ["accepted", "Accepted. Your food is on its way to being made."],
    // Diners don't see Ready (ruled 2026-09-30): food at the pass still reads as Preparing.
    ["ready", "Preparing. It's being made now."],
  ] as const) {
    await rest(fx.ownerJwt, `orders?id=eq.${orderId}`, { method: "PATCH", body: { status } });
    await expect(page.getByRole("heading", { name: copy })).toBeVisible({ timeout: 10_000 });
  }
  await expect(page.getByRole("listitem").filter({ hasText: "Preparing" })).toContainText("Now");
  await expect(page.getByRole("listitem").filter({ hasText: "Served" })).not.toContainText("Done");
  await expect(page.getByText("Ready", { exact: true })).toHaveCount(0);

  // The menu links back to the active order.
  await page.getByRole("link", { name: "Order more" }).click();
  await page.getByRole("link", { name: "Orders" }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
});

test("a table closed by staff says so instead of opening a new tab", async ({ page }) => {
  await scanAndAdd(page, "A1", ["Tuna Crudo"]);
  const [open] = await rest<Array<{ id: string }>>(
    fx.ownerJwt,
    `table_sessions?table_id=eq.${fx.tables.A1.id}&status=eq.open&select=id`,
  );
  await rest(fx.ownerJwt, "rpc/close_table_session", {
    method: "POST",
    body: { p_session_id: open.id },
  });
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This table was closed." })).toContainText(
    "This table was closed. To order again, ask your server to seat you.",
  );
  // A closed table must be seated again before it takes orders (Brief 04 prank protection).
  await page.getByRole("link", { name: "Scan again" }).click();
  await expect(page.getByRole("heading", { name: "Your table isn't open yet" })).toBeVisible();
  await seatTable(fx, "A1");
  await page.getByRole("link", { name: "Scan again" }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await skipNameSheet(page); // a new table session asks again
  await expect(page.getByRole("link", { name: /View order/ })).toHaveCount(0);
});

test("another diner's device receives no realtime changes for someone else's order", async ({
  page,
}) => {
  await scanAndAdd(page, "D1", ["Tuna Crudo"]);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderId = page.url().split("/").pop() as string;
  await expect(page.getByText("Live: this page updates on its own.")).toBeVisible({
    timeout: 15_000,
  });

  // A second anonymous diner subscribes to that order id, and to every order.
  const spy = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const signIn = await spy.auth.signInAnonymously({
    options: { captchaToken: TEST_CAPTCHA_TOKEN },
  });
  expect(signIn.error).toBeNull();
  await spy.realtime.setAuth();
  const received: unknown[] = [];
  const subscribed = new Promise<void>((resolve, reject) => {
    spy
      .channel("spy")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (p) => received.push(p),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) =>
        received.push(p),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
      });
  });
  await subscribed;

  // Positive control: the diner who placed it sees the change live.
  await rest(fx.ownerJwt, `orders?id=eq.${orderId}`, {
    method: "PATCH",
    body: { status: "accepted" },
  });
  await expect(
    page.getByRole("heading", { name: "Accepted. Your food is on its way to being made." }),
  ).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(3_000);
  expect(received).toEqual([]);
  await spy.removeAllChannels();
});

test("an item whose section was hidden after it went in the cart is named and removed", async ({
  page,
}) => {
  await addUnseatedTable(fx, "E2");
  await seatTable(fx, "E2");
  await scanAndAdd(page, "E2", ["Tuna Crudo", "Grilled Salmon"]);
  const starters = await rest<Array<{ id: string }>>(
    fx.ownerJwt,
    `menu_categories?restaurant_id=eq.${fx.restaurantId}&name=eq.Starters&select=id`,
  );
  const hide = (is_active: boolean) =>
    rest(fx.ownerJwt, `menu_categories?id=eq.${starters[0].id}`, {
      method: "PATCH",
      body: { is_active },
    });
  await hide(false);
  try {
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Tuna Crudo" })).toHaveText(
      "Sorry, Tuna Crudo just sold out. We took it off your order.",
    );
    await expect(page.getByRole("listitem").filter({ hasText: "Tuna Crudo" })).toHaveCount(0);
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  } finally {
    await hide(true);
  }
});
