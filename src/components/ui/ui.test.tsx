import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ActionButton,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Textarea,
} from ".";

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

describe("Select and Textarea", () => {
  it("link their label, hint and error to the field", () => {
    render(
      <>
        <Select label="Category" hint="Pick one" error="Required">
          <option value="">None</option>
        </Select>
        <Textarea label="Description" hint="Optional" />
      </>,
    );
    const select = screen.getByLabelText("Category");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Pick one Required");
    expect(screen.getByLabelText("Description")).toHaveAccessibleDescription("Optional");
  });
});

describe("ActionButton", () => {
  it("posts its hidden fields and announces a failure", async () => {
    const action = vi.fn(async (_prev: unknown, formData: FormData) => {
      expect(formData.get("id")).toBe("t1");
      return { ok: false as const, error: { code: "not_allowed" as const, message: "Nope." } };
    });
    render(
      <ActionButton action={action} fields={{ id: "t1" }}>
        Deactivate
      </ActionButton>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope.");
    expect(action).toHaveBeenCalledOnce();
  });
});

describe("ConfirmDialog", () => {
  it("opens a labelled modal, cancels without acting, and confirms with its fields", async () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    // jsdom has no modal dialog support; the browser behaviour is covered by e2e.
    HTMLDialogElement.prototype.showModal = showModal;
    HTMLDialogElement.prototype.close = close;
    const action = vi.fn(async () => ({ ok: true as const, data: null }));

    render(
      <ConfirmDialog
        triggerLabel="Rotate QR"
        triggerContext="A4"
        title="Rotate the QR for A4?"
        body="Printed codes for A4 will stop working."
        confirmLabel="Rotate"
        action={action}
        fields={{ id: "t1" }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Rotate QR A4" }));
    expect(showModal).toHaveBeenCalledOnce();
    const dialog = screen.getByRole("dialog", { name: "Rotate the QR for A4?" });
    expect(dialog).toHaveAccessibleDescription("Printed codes for A4 will stop working.");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
    expect(action).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Rotate QR A4" }));
    await userEvent.click(screen.getByRole("button", { name: "Rotate", hidden: true }));
    expect(action).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
