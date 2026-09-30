import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { isSignedInStaff } from "@/lib/staff-auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Salu" };

const NOTICES: Record<string, string> = {
  confirm:
    "That confirmation link didn't work or has expired. Sign in, or create your account again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isSignedInStaff()) redirect("/restaurant/dashboard");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Salu for restaurants</h1>
        <p className="text-muted">Sign in to run your menu, tables and orders.</p>
      </div>
      <LoginForm
        notice={error ? NOTICES[error] : undefined}
        turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      />
    </main>
  );
}
