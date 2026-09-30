"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

/**
 * Loads Cloudflare's script once per page and shares the wait. (next/script only tells
 * the first component that inserted a script when it loads, so a widget that re-mounts
 * mid-load, e.g. on a sign-in/sign-up switch, would never render.) A failed load is
 * forgotten, so a retry starts over.
 */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing"));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Cloudflare Turnstile, rendered explicitly with Cloudflare's own script (no wrapper
 * library). Usually invisible ("interaction-only"). Calls onToken with a fresh token,
 * or with null when the token expires or the check fails. A failure never dead-ends:
 * the person gets a retry button (Ari's condition, 2026-09-29).
 * Tokens are single-use: re-mount this component (change its key) after each attempt.
 */
export function Turnstile({
  siteKey,
  onToken,
  action,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  action?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const onTokenRef = useRef(onToken);
  const [failed, setFailed] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;
    const fail = () => {
      if (cancelled) return;
      setFailed(true);
      onTokenRef.current(null);
    };
    loadTurnstile()
      .then((api) => {
        const el = containerRef.current;
        if (cancelled || !el) return;
        const id = api.render(el, {
          sitekey: siteKey,
          action,
          appearance: "interaction-only",
          callback: (token: string) => {
            setFailed(false);
            onTokenRef.current(token);
          },
          "error-callback": fail,
          "timeout-callback": fail,
          "expired-callback": () => {
            onTokenRef.current(null);
            api.reset(id);
          },
        });
        widgetRef.current = { api, id };
      })
      .catch(fail);
    return () => {
      cancelled = true;
      widgetRef.current?.api.remove(widgetRef.current.id);
      widgetRef.current = null;
    };
  }, [siteKey, action, generation]);

  const retry = () => {
    setFailed(false);
    if (widgetRef.current) widgetRef.current.api.reset(widgetRef.current.id);
    else setGeneration((n) => n + 1);
  };

  return (
    <>
      <div ref={containerRef} />
      {failed && (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-danger">We couldn&apos;t check this device. Try again.</p>
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      )}
    </>
  );
}
