"use client";

import { Button, EmptyState } from "@/components/ui";

export default function PortalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      title="We couldn't load this page"
      body="Check your connection, then try again. Your data is safe."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
