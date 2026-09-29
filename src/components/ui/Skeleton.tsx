import { cn } from "./cn";

/** Loading placeholder. Hidden from screen readers; pair it with a status message. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-testid="skeleton"
      className={cn("animate-pulse rounded-card bg-surface-raised", className)}
    />
  );
}
