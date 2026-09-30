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
