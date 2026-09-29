"use client";

import { Button, EmptyState } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center p-6">
      <EmptyState
        title="Something went wrong"
        body="Check your connection, then try again."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </main>
  );
}
