"use client";

import { useEffect, useState } from "react";

/** Formats in the restaurant's zone; null if the stored zone isn't one this device knows. */
export function formatKitchenTime(timeZone: string, date: Date): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return null;
  }
}

/**
 * Current time in the restaurant's time zone (rule A7), so a wrong zone is obvious at a
 * glance. The portal layout renders this on every page, so a bad stored zone must never
 * throw here: that would take down Settings too, the one page that can fix it.
 */
export function KitchenClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const time = formatKitchenTime(timeZone, now);

  if (time === null) {
    return <p className="text-warning">Time zone not recognised. Check Settings.</p>;
  }
  return (
    <p className="text-muted">
      Kitchen time {/* Server and browser render a moment apart; the minute can differ. */}
      <time suppressHydrationWarning className="text-text">
        {time}
      </time>
    </p>
  );
}
