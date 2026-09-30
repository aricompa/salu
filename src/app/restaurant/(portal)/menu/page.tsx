import { requireMembership } from "@/lib/auth";

export const metadata = { title: "Menu · Salu" };

export default async function MenuPage() {
  await requireMembership();
  return <h1 className="text-3xl font-semibold">Menu</h1>;
}
