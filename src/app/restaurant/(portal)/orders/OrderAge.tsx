"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";
import { ticketAge } from "@/lib/board";

const tones = {
  neutral: "border-border text-muted",
  warning: "border-warning text-warning",
  danger: "border-danger text-danger font-semibold",
} as const;

/** Ticket age that ticks on the device ("6 min"), with text at each threshold (rule U4). */
export function OrderAge({ submittedAt }: { submittedAt: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const age = ticketAge(submittedAt, now);
  return (
    // Server and browser render a moment apart; the minute can differ.
    <span
      suppressHydrationWarning
      className={cn(
        "inline-flex shrink-0 items-center rounded-chip border px-2.5 py-0.5 text-base whitespace-nowrap",
        tones[age.tone],
      )}
    >
      {age.text}
    </span>
  );
}
