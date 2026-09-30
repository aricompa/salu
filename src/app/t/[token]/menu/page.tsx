import { getDinerSession } from "@/lib/diner";
import { TableClosed } from "../TableClosed";

export const metadata = { title: "Menu · Salu" };

export default async function MenuPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, session] = await Promise.all([params, getDinerSession()]);
  if (session.kind !== "open") return <TableClosed token={token} kind={session.kind} />;
  const { table } = session;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <header>
        <p className="text-sm text-muted">Table {table.tableLabel}</p>
        <h1 className="text-2xl font-semibold">{table.restaurantName}</h1>
      </header>
    </main>
  );
}
