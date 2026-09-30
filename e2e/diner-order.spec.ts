import { expect, test } from "@playwright/test";
import { createDinerFixture, rest, type DinerFixture } from "./helpers";

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
