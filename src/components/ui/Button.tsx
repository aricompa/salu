import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-contrast hover:opacity-90",
  secondary: "border border-border bg-surface-raised text-text hover:bg-surface",
  ghost: "text-text hover:bg-surface-raised",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
};

const base =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-card px-4 py-2 font-medium transition-opacity";

/** Button look for a link (e.g. "Add item" navigates, so it stays an <a>). */
export function buttonStyles(variant: Variant = "primary", className?: string): string {
  return cn(base, variants[variant], className);
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        base,
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-chip border-2 border-current border-t-transparent"
        />
      )}
      {children}
      {loading && <span className="sr-only">Loading</span>}
    </button>
  );
}
