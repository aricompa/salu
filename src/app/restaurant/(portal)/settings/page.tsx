import { requireMembership } from "@/lib/auth";

export const metadata = { title: "Settings · Salu" };

export default async function SettingsPage() {
  await requireMembership();
  return <h1 className="text-3xl font-semibold">Settings</h1>;
}
