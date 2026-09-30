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

const DEFAULT_MESSAGE = "You're offline. Changes won't save until the connection is back.";

/** Says when the device has lost its connection (rule U6). Server render assumes online. */
export function OfflineBanner({ message = DEFAULT_MESSAGE }: { message?: string }) {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p role="status" className="border-b border-warning px-6 py-3 text-warning print:hidden">
      {message}
    </p>
  );
}
