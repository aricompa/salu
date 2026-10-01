import { expect, test } from "@playwright/test";
import { createDinerFixture, dinerPlacesOrder, ownerCookies } from "./helpers";

/**
 * Long-service probe (Brief 04 task 5): access tokens expire, and realtime-js closes a
 * channel whose token isn't refreshed, so a board left open through service must keep
 * receiving orders after its first token has expired.
 *
 * Skipped unless SALU_LONG_SERVICE_PROBE is set to the local jwt_expiry in seconds. To run:
 * shorten `jwt_expiry` in supabase/config.toml (e.g. 120), restart Supabase, run with
 * SALU_LONG_SERVICE_PROBE=120, then restore the file byte-identical and restart. Never
 * push that config.
 */
const expirySeconds = Number(process.env.SALU_LONG_SERVICE_PROBE ?? 0);
test.skip(!expirySeconds, "long-service probe: set SALU_LONG_SERVICE_PROBE to the jwt_expiry");

/** The access token's expiry, read from the @supabase/ssr session cookie (maybe chunked). */
function accessTokenExpiry(cookies: Array<{ name: string; value: string }>): number {
  const parts = cookies
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const raw = parts.map((c) => c.value).join("");
  const session = JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString());
  const payload = JSON.parse(
    Buffer.from(session.access_token.split(".")[1], "base64url").toString(),
  ) as { exp: number };
  return payload.exp;
}

test("the board keeps receiving orders after its first access token expires", async ({
  browser,
}) => {
  test.setTimeout((expirySeconds * 3 + 120) * 1000);
  const fx = await createDinerFixture();
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await context.addCookies(await ownerCookies(fx));
  const page = await context.newPage();
  await page.goto("/restaurant/orders");
  const live = page.getByRole("status").filter({ hasText: /Live|Reconnecting|Connecting/ });
  await expect(live).toHaveText(/Live/, { timeout: 15_000 });

  // Record every change of the live indicator for the report.
  await page.evaluate(() => {
    const status = [...document.querySelectorAll('[role="status"]')].find((el) =>
      /Live|Reconnecting|Connecting/.test(el.textContent ?? ""),
    ) as HTMLElement;
    const log: string[] = [];
    (window as unknown as { indicator: string[] }).indicator = log;
    new MutationObserver(() =>
      log.push(`${new Date().toISOString()} ${status.textContent?.replace("●", "").trim()}`),
    ).observe(status, { subtree: true, childList: true, characterData: true });
  });

  const firstExpiry = accessTokenExpiry(await context.cookies());
  console.log(`first token expires ${new Date(firstExpiry * 1000).toISOString()}`);

  // Before expiry: a control order arrives.
  await dinerPlacesOrder(fx, "A1", [{ item: "Burrata" }]);
  await expect(page.getByRole("article", { name: "A1" })).toBeVisible({ timeout: 5_000 });

  // Wait until the first token is 15 s past expiry and the browser holds a newer one.
  await expect
    .poll(async () => accessTokenExpiry(await context.cookies()) > firstExpiry, {
      timeout: (expirySeconds + 60) * 1000,
      intervals: [5_000],
    })
    .toBe(true);
  const wait = firstExpiry * 1000 + 15_000 - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
  console.log(
    `now ${new Date().toISOString()}, token expires ${new Date(accessTokenExpiry(await context.cookies()) * 1000).toISOString()}`,
  );

  // After expiry: an order still arrives without a reload.
  const placed = Date.now();
  await dinerPlacesOrder(fx, "B1", [{ item: "Tuna Crudo" }]);
  await expect(page.getByRole("article", { name: "B1" })).toBeVisible({ timeout: 5_000 });
  console.log(`order after expiry on the board in ${Date.now() - placed} ms`);
  await expect(live).toHaveText(/Live/);
  console.log(
    `indicator changes: ${JSON.stringify(await page.evaluate(() => (window as unknown as { indicator: string[] }).indicator))}`,
  );
  await context.close();
});
