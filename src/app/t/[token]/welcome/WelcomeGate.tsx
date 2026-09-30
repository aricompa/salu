"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Turnstile } from "@/components/ui/Turnstile";

type Problem = null | "busy" | "error";
const BACKOFF_SECONDS = [5, 10, 20, 30];

/** Checks the device (Turnstile), signs the diner in anonymously, then goes back to the scan URL. */
export function WelcomeGate({
  token,
  siteKey,
  failedBefore,
}: {
  token: string;
  siteKey: string;
  failedBefore: boolean;
}) {
  const [problem, setProblem] = useState<Problem>(failedBefore ? "error" : null);
  const [attempt, setAttempt] = useState(0);
  const [busyTries, setBusyTries] = useState(0);
  const [wait, setWait] = useState(0);

  const onToken = useCallback(
    async (captchaToken: string | null) => {
      if (!captchaToken) return;
      // Loaded on demand: supabase-js is 66 KB gzip, and the device check takes a moment anyway.
      const { signInDiner } = await import("@/lib/diner-auth");
      const outcome = await signInDiner(captchaToken);
      if (outcome === "ok") {
        // A real navigation on purpose: /t/<token> is a Route Handler that joins the table
        // and sets its cookie, not a page the client router should fetch or prefetch.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/t/${token}`);
        return;
      }
      if (outcome === "rate_limited") {
        setWait(BACKOFF_SECONDS[Math.min(busyTries, BACKOFF_SECONDS.length - 1)]);
        setBusyTries((n) => n + 1);
        setProblem("busy");
      } else {
        setProblem("error");
      }
    },
    [token, busyTries],
  );

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const retry = () => {
    setProblem(null);
    setAttempt((n) => n + 1); // a fresh widget, since tokens are single-use
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="status" className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">
          {problem ? "Let's try that again" : "Getting your table ready…"}
        </h1>
        <p className="text-muted">
          {problem === "busy"
            ? "We're busy. Try again in a moment."
            : problem === "error"
              ? "Something went wrong. Check your connection and try again."
              : "No sign-up needed. The menu opens in a moment."}
        </p>
      </div>
      {!problem && <Turnstile key={attempt} siteKey={siteKey} action="diner" onToken={onToken} />}
      {problem && (
        <Button onClick={retry} disabled={wait > 0} className="w-full">
          {wait > 0 ? `Try again in ${wait}s` : "Try again"}
        </Button>
      )}
    </div>
  );
}
