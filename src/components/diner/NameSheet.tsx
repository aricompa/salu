"use client";

import { useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { ERROR_COPY, type ActionResult } from "@/lib/errors";

const askedKey = (sessionId: string) => `salu.name-asked.${sessionId}`;

/** Storage can be blocked (private mode): then the sheet simply asks again next visit. */
function askedBefore(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function rememberAsked(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Not remembered; this page view still closes the sheet.
  }
}

const noSubscription = () => () => {};

/**
 * "What should we call you?" over the menu, once per table session (PRD D2). Skip is as
 * big as Save; either answer, or closing the sheet, means it isn't asked again here.
 */
export function NameSheet({
  sessionId,
  save,
}: {
  sessionId: string;
  save: (name: string) => Promise<ActionResult<null>>;
}) {
  const key = askedKey(sessionId);
  // The server can't read storage: it renders the sheet closed, the browser decides.
  const asked = useSyncExternalStore(
    noSubscription,
    () => askedBefore(key),
    () => true,
  );
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const finish = () => {
    rememberAsked(key);
    setDone(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await save(name);
        if (result.ok) finish();
        else setError(result.error.message);
      } catch {
        // Offline or unreachable: keep the sheet open with a message, not the error page.
        setError(ERROR_COPY.connection);
      }
    });
  };

  return (
    <Sheet open={!asked && !done} onClose={finish} title="What should we call you?">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 pt-4">
        <Input
          label="Your name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          enterKeyHint="done"
          hint="Staff see it with your order. Optional."
          error={error ?? undefined}
        />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={finish} disabled={pending}>
            Skip
          </Button>
          <Button type="submit" loading={pending}>
            Save
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
