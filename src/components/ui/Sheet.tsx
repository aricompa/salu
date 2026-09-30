"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";

/**
 * Bottom sheet on the native <dialog>: showModal() traps focus, Escape closes, focus
 * returns to the opener. Slides in from the bottom unless reduced motion is on.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="mx-auto mt-auto mb-0 max-h-[85dvh] w-full max-w-2xl rounded-t-card border border-border bg-surface p-5 text-text backdrop:bg-scrim open:animate-[sheet-in_200ms_ease-out] motion-reduce:open:animate-none"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-2xl font-semibold">
          {title}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      {open && children}
    </dialog>
  );
}
