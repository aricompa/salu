"use client";

import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/components/ui";
import { setItemAvailabilityAction } from "./actions";

/**
 * The 86 switch. Works for every role: it calls set_item_availability(), the one
 * path floor staff have. Flips at once, then settles on what the server returns.
 */
export function AvailabilityToggle({
  itemId,
  itemName,
  available,
}: {
  itemId: string;
  itemName: string;
  available: boolean;
}) {
  const [shown, setShown] = useOptimistic(available);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-busy={pending || undefined}
        onClick={() =>
          startTransition(async () => {
            const next = !shown;
            setError(null);
            setShown(next);
            const result = await setItemAvailabilityAction(itemId, next);
            if (!result.ok) setError(result.error.message);
          })
        }
        className="inline-flex min-h-11 items-center gap-3 rounded-card px-2 font-medium"
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-chip border-2 transition-colors motion-reduce:transition-none",
            shown ? "border-success bg-success" : "border-border bg-surface",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0 size-5 rounded-chip transition-transform motion-reduce:transition-none",
              shown ? "translate-x-5.5 bg-surface" : "translate-x-0.5 bg-muted",
            )}
          />
        </span>
        <span>
          Available <span className="sr-only">{itemName}</span>
        </span>
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
