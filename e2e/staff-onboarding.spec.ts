import { expect, test } from "@playwright/test";
import { anonymousSessionCookies, confirmationLink, uniqueEmail } from "./helpers";

test("owner signs up, confirms email, creates a restaurant and sees the dashboard", async ({
  page,
}) => {
  const email = uniqueEmail("owner");
  const password = "correct-horse-battery";

  await page.goto("/login");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).last().click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await confirmationLink(email));
  await expect(page).toHaveURL(/\/restaurant\/onboarding$/);

  await page.getByLabel("Restaurant name").fill("Casa Grande");
  await expect(page.getByLabel("Link")).toHaveValue("casa-grande");

  // seed.sql creates demo-bistro, so this slug is always taken.
  await page.getByLabel("Link").fill("demo-bistro");
  await page.getByRole("button", { name: "Create restaurant" }).click();
  await expect(page.getByText("That link is taken. Try another.")).toBeVisible();

  await page.getByLabel("Link").fill(`casa-grande-${Date.now()}`);
  await page.getByRole("button", { name: "Create restaurant" }).click();
  await expect(page).toHaveURL(/\/restaurant\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Get set up" })).toBeVisible();
  await expect(page.getByText("0 of 3 done")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/restaurant/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("an anonymous diner session cannot open the staff portal", async ({ page, context }) => {
  const cookies = await anonymousSessionCookies();
  await context.addCookies(cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })));

  await page.goto("/restaurant/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/restaurant/onboarding");
  await expect(page).toHaveURL(/\/login$/);
});
