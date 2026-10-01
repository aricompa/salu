"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { useFreshOrder } from "./BoardLive";

/** The card's outline. A new order pulses while it waits in New (not under reduced motion). */
export function OrderCardFrame({
  id,
  labelledBy,
  waiting,
  children,
}: {
  id: string;
  labelledBy: string;
  waiting: boolean;
  children: ReactNode;
}) {
  const fresh = useFreshOrder(id) && waiting;
  return (
    <article
      aria-labelledby={labelledBy}
      className={cn(
        "flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4",
        fresh && "animate-[order-pulse_1.2s_ease-in-out_3] motion-reduce:animate-none",
      )}
    >
      {children}
    </article>
  );
}
