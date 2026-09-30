import { requireMembership } from "@/lib/auth";

export const metadata = { title: "Tables · Salu" };

export default async function TablesPage() {
  await requireMembership();
  return <h1 className="text-3xl font-semibold">Tables</h1>;
}
