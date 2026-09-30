import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateTableAction: vi.fn() }));
const { TableDetails } = await import("./TableDetails");

describe("TableDetails", () => {
  it("shows the label and seats, with an edit control for owners and managers", () => {
    render(<TableDetails id="t1" label="A4" capacity={4} manage />);
    expect(screen.getByRole("heading", { name: "A4" })).toBeInTheDocument();
    expect(screen.getByText("4 seats")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit A4" })).toBeInTheDocument();
  });

  it("is read-only for floor staff", () => {
    render(<TableDetails id="t1" label="B1" capacity={null} manage={false} />);
    expect(screen.getByText("Seats not set")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
