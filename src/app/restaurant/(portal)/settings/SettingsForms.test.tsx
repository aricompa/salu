import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateProfileAction: vi.fn(), updateOrderSettingsAction: vi.fn() }));
const { OrderSettingsForm } = await import("./OrderSettingsForm");
const { ProfileForm } = await import("./ProfileForm");

const zones = [{ region: "America", ids: ["America/Chicago", "America/New_York"] }];

describe("settings forms", () => {
  it("are editable for owners and managers", () => {
    render(
      <>
        <ProfileForm name="Casa" timezone="America/New_York" zones={zones} disabled={false} />
        <OrderSettingsForm editWindowMins={5} additionCutoffMins={20} disabled={false} />
      </>,
    );
    expect(screen.getByLabelText("Time zone")).toHaveValue("America/New_York");
    expect(screen.getByRole("option", { name: "America/New York" })).toBeInTheDocument();
    expect(screen.getByLabelText("Edit window (minutes)")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save order settings" })).toBeInTheDocument();
  });

  it("are read-only for floor staff", () => {
    render(
      <>
        <ProfileForm name="Casa" timezone="America/New_York" zones={zones} disabled />
        <OrderSettingsForm editWindowMins={5} additionCutoffMins={20} disabled />
      </>,
    );
    expect(screen.getByLabelText("Restaurant name")).toBeDisabled();
    expect(screen.getByLabelText("Edit window (minutes)")).toBeDisabled();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
