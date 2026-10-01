import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "min-h-11 rounded-card border bg-surface px-3 py-2 text-text",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      />
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
