import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setItemAvailabilityAction = vi.fn();
vi.mock("./actions", () => ({ setItemAvailabilityAction }));
const { AvailabilityToggle } = await import("./AvailabilityToggle");

describe("AvailabilityToggle", () => {
  beforeEach(() => setItemAvailabilityAction.mockReset());

  it("is a labelled switch that asks the server to 86 the item", async () => {
    setItemAvailabilityAction.mockResolvedValue({ ok: true, data: null });
    render(<AvailabilityToggle itemId="i1" itemName="Lobster Roll" available />);
    const toggle = screen.getByRole("switch", { name: "Available Lobster Roll" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);
    expect(setItemAvailabilityAction).toHaveBeenCalledWith("i1", false);
  });

  it("settles back and says why when the server refuses", async () => {
    setItemAvailabilityAction.mockResolvedValue({
      ok: false,
      error: { code: "not_allowed", message: "You don't have access to do that." },
    });
    render(<AvailabilityToggle itemId="i1" itemName="Lobster Roll" available />);
    const toggle = screen.getByRole("switch", { name: "Available Lobster Roll" });
    await userEvent.click(toggle);
    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have access");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});
