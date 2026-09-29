import { expect, test } from "@playwright/test";
import {
  anonymousSessionCookies,
  confirmationLink,
  createConfirmedStaff,
  staffSessionCookies,
  uniqueEmail,
} from "./helpers";

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

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await expect(page).toHaveURL(/\/restaurant\/dashboard$/);
});

test("an anonymous diner session cannot open the staff portal", async ({ browser, page }) => {
  // Positive control: cookies built the same way for a staff user DO get in, so a
  // redirect below means the anonymous session was recognized and refused,
  // not that the cookie was unreadable.
  const staff = await createConfirmedStaff(async (link) => {
    await page.goto(link);
  });
  const staffContext = await browser.newContext();
  await staffContext.addCookies(
    (await staffSessionCookies(staff.email, staff.password)).map((c) => ({
      ...c,
      domain: "localhost",
      path: "/",
    })),
  );
  const staffPage = await staffContext.newPage();
  await staffPage.goto("/restaurant/dashboard");
  await expect(staffPage).toHaveURL(/\/restaurant\/onboarding$/);
  await staffContext.close();

  const dinerContext = await browser.newContext();
  await dinerContext.addCookies(
    (await anonymousSessionCookies()).map((c) => ({ ...c, domain: "localhost", path: "/" })),
  );
  const dinerPage = await dinerContext.newPage();
  await dinerPage.goto("/restaurant/dashboard");
  await expect(dinerPage).toHaveURL(/\/login$/);
  await dinerPage.goto("/restaurant/onboarding");
  await expect(dinerPage).toHaveURL(/\/login$/);
  await dinerContext.close();
});
