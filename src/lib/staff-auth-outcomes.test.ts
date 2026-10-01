import { describe, expect, it } from "vitest";
import {
  newPasswordOutcome,
  resetOutcome,
  signInOutcome,
  signUpOutcome,
} from "./staff-auth-outcomes";

describe("staff auth outcomes", () => {
  it("maps sign-in errors without revealing which part was wrong", () => {
    expect(signInOutcome(null)).toBe("ok");
    expect(signInOutcome({ code: "invalid_credentials", status: 400 })).toBe("invalid_credentials");
    expect(signInOutcome({ code: "email_not_confirmed", status: 400 })).toBe("email_not_confirmed");
    expect(signInOutcome({ code: "captcha_failed", status: 400 })).toBe("captcha_failed");
    expect(signInOutcome({ code: "over_request_rate_limit", status: 429 })).toBe("rate_limited");
    expect(signInOutcome({ status: 500 })).toBe("error");
  });

  it("maps sign-up errors", () => {
    expect(signUpOutcome(null)).toBe("check_email");
    expect(signUpOutcome({ code: "weak_password", status: 422 })).toBe("weak_password");
    expect(signUpOutcome({ code: "over_email_send_rate_limit", status: 429 })).toBe("rate_limited");
  });

  it("never lets a reset request reveal whether the account exists", () => {
    expect(resetOutcome(null)).toBe("sent");
    // Only known addresses hit the resend cooldown or a mail failure.
    expect(resetOutcome({ code: "over_email_send_rate_limit", status: 429 })).toBe("sent");
    expect(resetOutcome({ status: 500 })).toBe("sent");
    expect(resetOutcome({ code: "captcha_failed", status: 400 })).toBe("captcha_failed");
    expect(resetOutcome({ status: 0 })).toBe("offline");
  });

  it("maps new-password errors to what the form can say", () => {
    expect(newPasswordOutcome(null)).toBe("ok");
    expect(newPasswordOutcome({ code: "same_password", status: 422 })).toBe("same_password");
    expect(newPasswordOutcome({ code: "weak_password", status: 422 })).toBe("weak_password");
    expect(newPasswordOutcome({ code: "session_not_found", status: 403 })).toBe("expired");
    expect(newPasswordOutcome({ status: 500 })).toBe("error");
  });
});
