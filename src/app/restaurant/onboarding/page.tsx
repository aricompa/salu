import { redirect } from "next/navigation";
import { getMembership, requireStaff } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Set up your restaurant · Salu" };

export default async function OnboardingPage() {
  const user = await requireStaff();
  if (await getMembership(user.userId)) redirect("/restaurant/dashboard");

  return (
    <main
      data-theme="dark"
      className="flex min-h-dvh items-center justify-center bg-surface p-6 text-text"
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Set up your restaurant</h1>
          <p className="text-muted">You can change these later.</p>
        </div>
        <OnboardingForm siteUrl={publicEnv().NEXT_PUBLIC_SITE_URL} />
      </div>
    </main>
  );
}
