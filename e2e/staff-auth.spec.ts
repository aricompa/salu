import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  anonymousSessionCookies,
  createConfirmedStaff,
  emailLink,
  staffSessionCookies,
  uniqueEmail,
} from "./helpers";

/** A confirmed staff member with no restaurant yet, signed up in a throwaway browser. */
async function confirmedStaff(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const staff = await createConfirmedStaff(async (link) => {
    await page.goto(link);
  });
  await context.close();
  return staff;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("staff sign in from the browser: the page itself asks Supabase Auth, with a device check", async ({
  browser,
  page,
}) => {
  const staff = await confirmedStaff(browser);

  await signIn(page, staff.email, "not-the-password");
  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toHaveText(
    "Email or password is incorrect.",
  );
  await expect(page.getByLabel("Email")).toHaveValue(staff.email);

  // Playwright only sees browser traffic: a sign-in made by the server would not show here.
  const tokenRequest = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().includes("/auth/v1/token?grant_type=password"),
  );
  await signIn(page, staff.email, staff.password);
  const body = JSON.parse((await tokenRequest).postData() ?? "{}") as {
    gotrue_meta_security?: { captcha_token?: string };
  };
  expect(body.gotrue_meta_security?.captcha_token).toBeTruthy();
  // No restaurant yet: the dashboard sends new staff to onboarding.
  await expect(page).toHaveURL(/\/restaurant\/onboarding$/);
});

test("password reset: the same answer for any email, a one-time link, and the old password stops working", async ({
  browser,
  page,
}) => {
  const staff = await confirmedStaff(browser);
  const sent = page.getByRole("status").filter({ hasText: "If an account exists" });

  await page.goto("/login");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill(uniqueEmail("nobody"));
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(sent).toContainText(
    "If an account exists for that email, we sent a link to set a new password.",
  );

  await page.getByRole("button", { name: "Back to sign in" }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(staff.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(sent).toContainText(
    "If an account exists for that email, we sent a link to set a new password.",
  );

  await page.goto(await emailLink(staff.email, "recovery"));
  await expect(page).toHaveURL(/\/login\/new-password$/);
  await page.getByLabel("New password").fill("too-short");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
  const newPassword = "a-brand-new-passphrase";
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/restaurant\/onboarding$/);

  const fresh = await (await browser.newContext()).newPage();
  await signIn(fresh, staff.email, staff.password);
  await expect(fresh.getByRole("alert").filter({ hasText: "incorrect" })).toHaveText(
    "Email or password is incorrect.",
  );
  await signIn(fresh, staff.email, newPassword);
  await expect(fresh).toHaveURL(/\/restaurant\/onboarding$/);
  await fresh.context().close();
});

test("the new-password page is for signed-in staff only", async ({ browser }) => {
  const asVisitor = await (await browser.newContext()).newPage();
  await asVisitor.goto("/login/new-password");
  await expect(asVisitor).toHaveURL(/\/login\?error=reset$/);
  await expect(asVisitor.getByText("That reset link didn't work or has expired.")).toBeVisible();

  const dinerContext = await browser.newContext();
  await dinerContext.addCookies(
    (await anonymousSessionCookies()).map((c) => ({ ...c, domain: "localhost", path: "/" })),
  );
  const asDiner = await dinerContext.newPage();
  await asDiner.goto("/login/new-password");
  await expect(asDiner).toHaveURL(/\/login\?error=reset$/);

  // Positive control: the same cookies built for a staff member do reach the page.
  const staff = await confirmedStaff(browser);
  const staffContext = await browser.newContext();
  await staffContext.addCookies(
    (await staffSessionCookies(staff.email, staff.password)).map((c) => ({
      ...c,
      domain: "localhost",
      path: "/",
    })),
  );
  const asStaff = await staffContext.newPage();
  await asStaff.goto("/login/new-password");
  await expect(asStaff.getByRole("heading", { name: "Set a new password" })).toBeVisible();

  await Promise.all([asVisitor.context().close(), dinerContext.close(), staffContext.close()]);
});
