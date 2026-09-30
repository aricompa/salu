export const metadata = { title: "Table unavailable · Salu" };

/** Unknown, rotated and deactivated codes all land here with the same copy (PRD D1). */
export default function UnavailablePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-end gap-3 p-6 pb-16">
      <h1 className="text-3xl font-semibold">This table code isn&apos;t active</h1>
      <p className="text-muted">Ask your server for help.</p>
    </main>
  );
}
