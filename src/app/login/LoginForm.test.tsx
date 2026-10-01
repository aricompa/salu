import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The device check answers at once with a token, as Cloudflare's test keys do.
vi.mock("@/components/ui/Turnstile", () => ({
  Turnstile: ({ onToken }: { onToken: (token: string) => void }) => {
    useEffect(() => onToken("test-token"), [onToken]);
    return null;
  },
}));
vi.mock("@/lib/staff-auth-browser", () => ({
  signInStaff: vi.fn(),
  signUpStaff: vi.fn(),
  requestPasswordReset: vi.fn(),
}));

const auth = await import("@/lib/staff-auth-browser");
const { LoginForm } = await import("./LoginForm");

const form = () => render(<LoginForm turnstileSiteKey="key" next="/restaurant/dashboard" />);

describe("LoginForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signs in from the browser with the device check's token", async () => {
    vi.mocked(auth.signInStaff).mockResolvedValue("invalid_credentials");
    form();
    await userEvent.type(screen.getByLabelText("Email"), "Owner@Example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(auth.signInStaff).toHaveBeenCalledWith(
      { email: "owner@example.com", password: "correct-horse-battery" },
      "test-token",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
  });

  it("never reveals password rules on sign-in", async () => {
    form();
    await userEvent.type(screen.getByLabelText("Email"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(auth.signInStaff).not.toHaveBeenCalled();
  });

  it("shows sign-up problems next to their fields", async () => {
    vi.mocked(auth.signUpStaff).mockResolvedValue("weak_password");
    form();
    await userEvent.click(screen.getByRole("tab", { name: "Create account" }));
    await userEvent.type(screen.getByLabelText("Email"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password12");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Choose a stronger password.")).toBeVisible();
  });

  it("answers a reset request the same way, and can send another after going back", async () => {
    vi.mocked(auth.requestPasswordReset).mockResolvedValue("sent");
    form();
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    expect(screen.queryByLabelText("Password")).toBeNull();
    await userEvent.type(screen.getByLabelText("Email"), "anyone@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/If an account exists for that email/)).toBeVisible();
    expect(auth.requestPasswordReset).toHaveBeenCalledWith("anyone@example.com", "test-token");

    await userEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByLabelText("Email")).toBeVisible();
  });

  it("says when the device check failed, without blaming the account", async () => {
    vi.mocked(auth.requestPasswordReset).mockResolvedValue("captcha_failed");
    form();
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    await userEvent.type(screen.getByLabelText("Email"), "anyone@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't check this device. Try again.",
    );
  });
});
