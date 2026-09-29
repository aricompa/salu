import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from ".";

describe("Button", () => {
  it("renders an accessible button that handles clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Place order</Button>);
    const button = screen.getByRole("button", { name: "Place order" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("min-h-11");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and announces loading while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: /save/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading")).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Input", () => {
  it("links its label, hint and error to the input", () => {
    render(<Input label="Email" hint="We'll send a link" error="Enter an email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("We'll send a link Enter an email");
  });

  it("has no error state by default", () => {
    render(<Input label="Name" />);
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
  });
});

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Table A4</Card>);
    expect(screen.getByText("Table A4")).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("always shows its text label", () => {
    render(<Badge tone="danger">Sold out</Badge>);
    expect(screen.getByText("Sold out").className).toContain("text-danger");
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive tech", () => {
    render(<Skeleton className="h-4" />);
    expect(screen.getByTestId("skeleton")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("EmptyState", () => {
  it("renders title, body and action", () => {
    render(
      <EmptyState
        title="No items yet"
        body="Add your first dish."
        action={<Button>Add item</Button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No items yet" })).toBeInTheDocument();
    expect(screen.getByText("Add your first dish.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
  });
});
