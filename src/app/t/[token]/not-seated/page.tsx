import { redirect } from "next/navigation";
import { qrTokenSchema } from "@/lib/validation/diner";

export const metadata = { title: "Table not open yet · Salu" };

/**
 * The table's code is real, but staff haven't seated it (prank protection, ruled
 * 2026-09-30). A plain <a> back to the scan URL: it's a Route Handler that joins, so it
 * must never be prefetched.
 */
export default async function NotSeatedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!qrTokenSchema.safeParse(token).success)
    redirect(`/t/${encodeURIComponent(token)}/unavailable`);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-end gap-4 p-6 pb-16">
      <h1 className="text-3xl font-semibold">Your table isn&apos;t open yet</h1>
      <p className="text-muted">Ask your server to seat you, then scan again.</p>
      <a
        href={`/t/${token}`}
        className="inline-flex min-h-11 items-center justify-center rounded-card bg-brand px-4 py-2 font-medium text-brand-contrast"
      >
        Scan again
      </a>
    </main>
  );
}
