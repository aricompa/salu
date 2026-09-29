import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">Salu for restaurants</h1>
      <p className="text-muted">
        Guests scan the code on their table and order from their phone. You run the menu, tables and
        a live order board from one place.
      </p>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center justify-center rounded-card bg-brand px-4 font-medium text-brand-contrast"
      >
        Staff sign in
      </Link>
    </main>
  );
}
