"use client";

import { ConfirmDialog, useToast } from "@/components/ui";
import { rotateTableQrAction } from "./actions";

export function RotateQrButton({ id, label }: { id: string; label: string }) {
  const toast = useToast();
  return (
    <ConfirmDialog
      triggerLabel="Rotate QR"
      triggerContext={label}
      title={`Rotate the QR code for ${label}?`}
      body={`Printed codes for ${label} will stop working. You'll need to print a new one.`}
      confirmLabel="Rotate QR"
      action={rotateTableQrAction}
      fields={{ id }}
      onDone={() => toast(`New code ready for ${label}. Print it from the sheet.`)}
    />
  );
}
