import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { isSignedInStaff } from "@/lib/staff-auth";
import { safeNextPath } from "@/lib/validation/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Salu" };

const NOTICES: Record<string, string> = {
  confirm:
    "That confirmation link didn't work or has expired. Sign in, or create your account again.",
  reset: "That reset link didn't work or has expired. Use Forgot password? to get a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const destination = safeNextPath(next, "/restaurant/dashboard");
  if (await isSignedInStaff()) redirect(destination);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Salu for restaurants</h1>
        <p className="text-muted">Sign in to run your menu, tables and orders.</p>
      </div>
      <LoginForm
        notice={error ? NOTICES[error] : undefined}
        turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        next={destination}
      />
    </main>
  );
}
