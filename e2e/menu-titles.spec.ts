import { expect, test } from "@playwright/test";
import { createDinerFixture, rest, skipNameSheet, type DinerFixture } from "./helpers";

// Menu section titles stay on one line (ruled 2026-10-04): a long name shrinks just enough,
// never below 26px; a short one keeps its 42px; a name too long even at 26px wraps, uncut.
const LONG = "Cleveland Smoked Meat";
const TOO_LONG = "Cleveland Smoked Meat, Pastrami and Friends of the Lake";
let fx: DinerFixture;

test.beforeAll(async () => {
  fx = await createDinerFixture();
  const categories = await rest<Array<{ id: string }>>(fx.ownerJwt, "menu_categories", {
    method: "POST",
    prefer: "return=representation",
    body: [LONG, TOO_LONG].map((name, i) => ({
      restaurant_id: fx.restaurantId,
      name,
      sort_order: 5 + i,
      is_active: true,
    })),
  });
  await rest(fx.ownerJwt, "menu_items", {
    method: "POST",
    body: categories.map((c) => ({
      restaurant_id: fx.restaurantId,
      category_id: c.id,
      name: "Reuben",
      price_cents: 2300,
    })),
  });
});

async function measure(page: import("@playwright/test").Page, name: string) {
  const heading = page.getByRole("heading", { name, level: 2, exact: true });
  await heading.scrollIntoViewIfNeeded();
  return heading.evaluate((h) => {
    const text = h.firstElementChild as HTMLElement;
    return {
      fontSize: parseFloat(getComputedStyle(h).fontSize),
      textWidth: text.offsetWidth,
      column: h.clientWidth,
      lines: Math.round(
        text.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight),
      ),
    };
  });
}

for (const width of [390, 320]) {
  test(`section titles stay on one line at ${width}px wide`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    await page.goto(`/t/${fx.tables.C1.token}`);
    await expect(page).toHaveURL(/\/menu$/, { timeout: 20_000 });
    await skipNameSheet(page);
    await page.evaluate(() => document.fonts.ready);

    const long = await measure(page, LONG);
    expect(long.lines).toBe(1);
    expect(long.textWidth).toBeLessThanOrEqual(long.column);
    expect(long.fontSize).toBeLessThan(42);
    expect(long.fontSize).toBeGreaterThanOrEqual(26);

    const short = await measure(page, "Starters");
    expect(short.lines).toBe(1);
    expect(short.fontSize).toBe(42);

    const tooLong = await measure(page, TOO_LONG);
    expect(tooLong.lines).toBeGreaterThan(1);
    expect(tooLong.textWidth).toBeLessThanOrEqual(tooLong.column);
    expect(tooLong.fontSize).toBe(26);

    // The page itself never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await context.close();
  });
}
