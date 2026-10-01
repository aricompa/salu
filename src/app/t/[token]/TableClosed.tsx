/**
 * Shown when there is no open table session for this device: the table was closed by staff,
 * or the page was opened without scanning. A plain <a> (never a prefetching Link): the scan
 * URL is a Route Handler that joins the table.
 */
export function TableClosed({ token, kind }: { token: string; kind: "closed" | "none" }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-end gap-4 p-6 pb-16">
      <h1 className="text-3xl font-semibold">
        {kind === "closed" ? "This table has been closed" : "Scan the code on your table"}
      </h1>
      <p className="text-muted">
        {kind === "closed"
          ? "Thanks for dining! To order again, ask your server to seat you."
          : "Your table's QR code opens the menu."}
      </p>
      <a
        href={`/t/${token}`}
        className="inline-flex min-h-11 items-center justify-center rounded-card bg-brand px-4 py-2 font-medium text-brand-contrast"
      >
        {kind === "closed" ? "Scan again" : "Open the menu"}
      </a>
    </main>
  );
}
