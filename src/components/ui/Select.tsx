import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
};

/** Native select: keyboard, screen-reader and mobile pickers work without extra code. */
export function Select({ label, hint, error, id, className, children, ...props }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="font-medium">
        {label}
      </label>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "min-h-11 rounded-card border bg-surface px-3 py-2 text-text",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {hint && (
        <p id={hintId} className="text-sm text-muted portal:text-base">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger portal:text-base">
          {error}
        </p>
      )}
    </div>
  );
}
