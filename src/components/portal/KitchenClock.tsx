"use client";

import { useEffect, useState } from "react";

const format = (timeZone: string, date: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);

/** Current time in the restaurant's time zone (rule A7), so a wrong zone is obvious at a glance. */
export function KitchenClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="text-muted">
      Kitchen time {/* Server and browser render a moment apart; the minute can differ. */}
      <time suppressHydrationWarning className="text-text">
        {format(timeZone, now)}
      </time>
    </p>
  );
}
