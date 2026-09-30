"use client";

import { useId } from "react";
import { cn } from "./cn";

/** Quantity stepper: labelled group, 44px buttons, the value announced as it changes. */
export function Stepper({
  label,
  value,
  min = 1,
  max = 50,
  onChange,
  context,
  className,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** Screen-reader-only words naming what is being counted, e.g. the item name. */
  context?: string;
  className?: string;
}) {
  const labelId = useId();
  const button =
    "inline-flex size-11 items-center justify-center rounded-chip border border-border text-xl font-semibold disabled:opacity-40";
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn("flex items-center gap-3", className)}
    >
      <span id={labelId} className="sr-only">
        {label}
        {context ? ` ${context}` : ""}
      </span>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <span aria-hidden="true">−</span>
        <span className="sr-only">Remove one{context ? ` ${context}` : ""}</span>
      </button>
      <output aria-live="polite" className="min-w-8 text-center text-lg font-semibold">
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <span aria-hidden="true">+</span>
        <span className="sr-only">Add one{context ? ` ${context}` : ""}</span>
      </button>
    </div>
  );
}
