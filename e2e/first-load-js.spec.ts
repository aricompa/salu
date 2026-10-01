import { expect, test } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { addUnseatedTable, createDinerFixture, skipNameSheet } from "./helpers";

/**
 * First-load JS per diner page, against PRD 5.9's 150 KB gzip budget. The method (ruled
 * 2026-09-30): gzip every script the page's HTML loads, skipping `noModule` scripts (the
 * legacy polyfills modern browsers never download). Skipped unless SALU_BUNDLE_PROBE is
 * set; run it against a production build:
 * `npm run build && CI=1 SALU_BUNDLE_PROBE=1 npx playwright test e2e/first-load-js.spec.ts`.
 */
test.skip(!process.env.SALU_BUNDLE_PROBE, "first-load JS probe: set SALU_BUNDLE_PROBE=1");

const BUDGET_KB = 150;

test("every diner page loads 150 KB of JavaScript or less (gzip)", async ({ browser }) => {
  const fx = await createDinerFixture();
  const unseated = await addUnseatedTable(fx, "Z9");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const token = fx.tables.A1.token;
  const gzipped = new Map<string, number>();

  async function firstLoadKb(path: string): Promise<number> {
    const html = await (await context.request.get(path, { maxRedirects: 0 })).text();
    const scripts = [...html.matchAll(/<script([^>]+)>/g)]
      .filter((m) => !/noModule/i.test(m[1]))
      .map((m) => m[1].match(/src="([^"]+\.js[^"]*)"/)?.[1])
      .filter((src): src is string => Boolean(src));
    let bytes = 0;
    for (const src of new Set(scripts)) {
      if (!gzipped.has(src)) {
        gzipped.set(src, gzipSync(await (await context.request.get(src)).body()).length);
      }
      bytes += gzipped.get(src)!;
    }
    return Math.round(bytes / 102.4) / 10;
  }

  const sizes: Record<string, number> = {};
  sizes.welcome = await firstLoadKb(`/t/${token}/welcome`);
  sizes["not-seated"] = await firstLoadKb(`/t/${unseated.token}/not-seated`);
  await page.goto(`/t/${token}`);
  await expect(page).toHaveURL(/\/menu$/, { timeout: 20_000 });
  sizes.menu = await firstLoadKb(`/t/${token}/menu`);
  await skipNameSheet(page);
  await page.getByRole("button", { name: /Burrata/ }).click();
  await page
    .getByRole("dialog", { name: "Burrata" })
    .getByRole("button", { name: /^Add ·/ })
    .click();
  await page.getByRole("link", { name: /View order/ }).click();
  sizes.cart = await firstLoadKb(`/t/${token}/cart`);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\//);
  sizes.order = await firstLoadKb(new URL(page.url()).pathname);

  console.log(`FIRST-LOAD-JS KB ${JSON.stringify(sizes)}`);
  for (const [name, kb] of Object.entries(sizes)) expect(kb, name).toBeLessThanOrEqual(BUDGET_KB);
  await context.close();
});
