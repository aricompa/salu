import { expect, test, type Page } from "@playwright/test";
import { PUBLISHABLE_KEY, SUPABASE_URL, createConfirmedStaff } from "./helpers";

/** Signs up and confirms a new owner, then creates their restaurant. */
async function onboardOwner(page: Page): Promise<void> {
  await createConfirmedStaff(async (link) => {
    await page.goto(link);
  });
  await expect(page).toHaveURL(/\/restaurant\/onboarding$/);
  await page.getByLabel("Restaurant name").fill("Portal Test Kitchen");
  await page.getByLabel("Link").fill(`portal-test-${Date.now()}`);
  await page.getByRole("button", { name: "Create restaurant" }).click();
  await expect(page).toHaveURL(/\/restaurant\/dashboard$/);
}

/** Menus are publicly readable, so the stored row can be checked with the publishable key. */
async function storedItem(name: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/menu_items?select=price_cents,is_available,dietary_tags&name=eq.${encodeURIComponent(name)}`,
    { headers: { apikey: PUBLISHABLE_KEY } },
  );
  const rows = (await res.json()) as Array<{
    price_cents: number;
    is_available: boolean;
    dietary_tags: string[];
  }>;
  expect(rows).toHaveLength(1);
  return rows[0];
}

test("owner builds a menu: categories, items in cents, the 86 toggle", async ({ page }) => {
  const itemName = `Lobster Roll ${Date.now()}`;
  await onboardOwner(page);

  await page.getByRole("link", { name: "Menu" }).first().click();
  await expect(page.getByText("Start with a category, then add items to it.")).toBeVisible();

  await page.getByLabel("New category").fill("Mains");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Mains" })).toBeVisible();
  await expect(page.getByLabel("New category")).toHaveValue("");
  await page.getByLabel("New category").fill("Drinks");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Drinks" })).toBeVisible();

  // Reorder: Drinks moves above Mains.
  await page.getByRole("button", { name: "Move up Drinks" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Drinks", "Mains"]);

  // Validation: a price with three decimals is refused with a field error.
  await page.getByRole("link", { name: "Add item to Mains" }).click();
  await expect(page.getByLabel("Category")).toHaveValue(/.+/);
  await page.getByLabel("Name").fill(itemName);
  await page.getByLabel("Price").fill("12.555");
  await page.getByLabel("Gluten-free").check();
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Enter a price like 12.50, up to 10,000.00.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue(itemName);
  await expect(page.getByLabel("Gluten-free")).toBeChecked();

  await page.getByLabel("Price").fill("12.50");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page).toHaveURL(/\/restaurant\/menu$/);
  await expect(page.getByText("$12.50")).toBeVisible();
  expect(await storedItem(itemName)).toEqual({
    price_cents: 1250,
    is_available: true,
    dietary_tags: ["gluten-free"],
  });

  // 86 it inline, and it survives a reload.
  const toggle = page.getByRole("switch", { name: `Available ${itemName}` });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(page.getByText("Sold out", { exact: true })).toBeVisible();
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  expect((await storedItem(itemName)).is_available).toBe(false);

  // A category with items can't be deleted; an empty one can.
  await expect(page.getByRole("button", { name: "Delete Mains" })).toBeDisabled();
  await page.getByRole("button", { name: "Delete Drinks" }).click();
  await page.getByRole("button", { name: "Delete category" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Drinks" })).toHaveCount(0);

  // Hide and show a category.
  await page.getByRole("button", { name: "Hide Mains" }).click();
  await expect(page.getByText("Hidden from diners. Its items stay here.")).toBeVisible();
  await page.getByRole("button", { name: "Show Mains" }).click();
  await expect(page.getByText("Hidden from diners. Its items stay here.")).toHaveCount(0);

  // Rename inline.
  await page.getByRole("button", { name: "Rename Mains" }).click();
  await page.getByLabel("Rename Mains").fill("Mains and grills");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Mains and grills" })).toBeVisible();

  // Edit the price; then delete the item behind a confirmation.
  await page.getByRole("link", { name: `Edit ${itemName}` }).click();
  await expect(page.getByLabel("Price")).toHaveValue("12.50");
  await page.getByLabel("Price").fill("13");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("$13.00")).toBeVisible();
  expect((await storedItem(itemName)).price_cents).toBe(1300);

  await page.getByRole("button", { name: `Delete ${itemName}` }).click();
  await expect(page.getByRole("dialog")).toContainText("Past orders keep their copy");
  await page.getByRole("button", { name: "Delete item" }).click();
  await expect(page.getByText(itemName)).toHaveCount(0);
});

test("owner adds tables, rotates a QR code and prints the sheet", async ({ page }) => {
  await onboardOwner(page);
  await page.getByRole("link", { name: "Tables" }).first().click();
  await expect(page.getByText("No tables yet")).toBeVisible();

  await page.getByLabel("New table").fill("A4");
  await page.getByLabel("Seats").fill("4");
  await page.getByRole("button", { name: "Add table" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "A4" })).toBeVisible();
  await expect(page.getByText("4 seats")).toBeVisible();

  // Labels are unique per restaurant; the message names the table.
  await page.getByLabel("New table").fill("A4");
  await page.getByRole("button", { name: "Add table" }).click();
  await expect(page.getByText("You already have a table called A4.")).toBeVisible();

  await page.getByLabel("New table").fill("B1");
  await page.getByLabel("Seats").fill("");
  await page.getByRole("button", { name: "Add table" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "B1" })).toBeVisible();
  await expect(page.getByText("Seats not set")).toBeVisible();

  // Rotate A4: the diner link changes and the old one is gone.
  const a4 = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "A4" }) });
  const before = await a4.locator("code").getAttribute("title");
  expect(before).toMatch(/\/t\/[0-9a-f]{32}$/);
  await page.getByRole("button", { name: "Rotate QR A4" }).click();
  await expect(page.getByRole("dialog")).toContainText("Printed codes for A4 will stop working.");
  await page.getByRole("dialog").getByRole("button", { name: "Rotate QR" }).click();
  await expect(page.getByText("New code ready. Print it from the sheet.")).toBeVisible();
  await expect(a4.locator("code")).not.toHaveAttribute("title", before as string);
  await expect(page.locator(`code[title="${before}"]`)).toHaveCount(0);

  // Deactivate B1: it drops off the print sheet. There is no delete control.
  await page.getByRole("button", { name: "Deactivate B1" }).click();
  await expect(page.getByText("Inactive", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);

  await page.getByRole("link", { name: "Print QR codes" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  const card = page.getByRole("article", { name: "Table A4" });
  await expect(
    card.getByRole("img", { name: "QR code for table A4" }).locator("svg"),
  ).toBeVisible();
  await expect(card).toContainText("Portal Test Kitchen");
  await expect(card).toContainText("Scan to order");

  // Reactivate B1 and rename A4 inline.
  await page.getByRole("link", { name: "Back to tables" }).click();
  await page.getByRole("button", { name: "Reactivate B1" }).click();
  await expect(page.getByText("Inactive", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit A4" }).click();
  await page.getByLabel("Name for A4").fill("A5");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "A5" })).toBeVisible();
});
