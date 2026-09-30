"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/** The diner link, shortened on screen, with a copy button. Owners and managers only. */
export function TableLink({ url, label }: { url: string; label: string }) {
  const [status, setStatus] = useState("");
  const token = url.slice(url.lastIndexOf("/") + 1);
  const short = `/t/${token.slice(0, 6)}…${token.slice(-4)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-card bg-surface px-2 py-1 text-base" title={url}>
        {short}
      </code>
      <Button
        variant="ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setStatus("Link copied.");
          } catch {
            setStatus("Couldn't copy. Use the print sheet instead.");
          }
        }}
      >
        Copy link <span className="sr-only">for {label}</span>
      </Button>
      <span role="status" className="text-sm text-muted">
        {status}
      </span>
    </div>
  );
}
