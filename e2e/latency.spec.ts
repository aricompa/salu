import { expect, test } from "@playwright/test";
import { createDinerFixture, dinerPlacesOrder, ownerCookies } from "./helpers";

/**
 * Latency probe (Brief 04 task 5): 20 orders, each timed from place_order returning to
 * its card appearing on the board. Desk evidence only; the Phase 1 exit criterion (2 s
 * p95) is about the hosted system. Skipped unless SALU_LATENCY_PROBE is set; run it
 * against a production build: `npm run build && CI=1 SALU_LATENCY_PROBE=1 npx playwright
 * test e2e/latency.spec.ts`.
 */
test.skip(!process.env.SALU_LATENCY_PROBE, "latency probe: set SALU_LATENCY_PROBE=1");

type Seen = { seen: Record<string, number> };

test("p95 from place_order returning to the card on the board, over 20 orders", async ({
  browser,
}) => {
  test.setTimeout(5 * 60_000);
  const fx = await createDinerFixture();
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await context.addCookies(await ownerCookies(fx));
  const page = await context.newPage();
  await page.goto("/restaurant/orders");
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible({
    timeout: 15_000,
  });

  // The browser notes when each card's heading first appears (same clock as this process).
  await page.evaluate(() => {
    const state = window as unknown as Seen;
    state.seen = {};
    const note = () => {
      for (const h of document.querySelectorAll('h3[id^="order-"]'))
        if (!(h.id in state.seen)) state.seen[h.id] = Date.now();
    };
    note();
    new MutationObserver(note).observe(document.body, { subtree: true, childList: true });
  });

  const labels = Object.keys(fx.tables);
  const latencies: number[] = [];
  for (let i = 0; i < 20; i++) {
    const { orderId } = await dinerPlacesOrder(fx, labels[i % labels.length], [
      { item: "Burrata" },
    ]);
    const returned = Date.now();
    const seenAt = async () =>
      page.evaluate((id) => (window as unknown as Seen).seen[`order-${id}`] ?? null, orderId);
    await expect.poll(seenAt, { timeout: 10_000, intervals: [50] }).not.toBeNull();
    latencies.push((await seenAt())! - returned);
    await page.waitForTimeout(300);
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const rank = (p: number) => sorted[Math.ceil(p * sorted.length) - 1];
  const report = { n: sorted.length, p50: rank(0.5), p95: rank(0.95), max: sorted.at(-1), sorted };
  console.log(`LATENCY ${JSON.stringify(report)}`);
  expect(report.p95).toBeLessThan(2_000);
  await context.close();
});
