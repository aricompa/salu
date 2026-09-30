"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui";
import { rotateTableQrAction } from "./actions";

export function RotateQrButton({ id, label }: { id: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1">
      <ConfirmDialog
        triggerLabel="Rotate QR"
        triggerContext={label}
        title={`Rotate the QR code for ${label}?`}
        body={`Printed codes for ${label} will stop working. You'll need to print a new one.`}
        confirmLabel="Rotate QR"
        action={rotateTableQrAction}
        fields={{ id }}
        onDone={() => setDone(true)}
      />
      <p role="status" className="text-sm text-muted">
        {done ? "New code ready. Print it from the sheet." : ""}
      </p>
    </div>
  );
}
