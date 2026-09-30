"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Tells staff when the tablet has lost its connection (rule U6). Server render assumes online. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p role="status" className="border-b border-warning px-6 py-3 text-warning print:hidden">
      You&apos;re offline. Changes won&apos;t save until the connection is back.
    </p>
  );
}
