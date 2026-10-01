import { redirect } from "next/navigation";
import { isSignedInStaff } from "@/lib/staff-auth";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata = { title: "New password · Salu" };

/**
 * Where a password-reset link lands, already signed in by /auth/confirm. Staff only,
 * checked on the server with getClaims(): an anonymous diner or a signed-out visitor is
 * sent back to /login.
 */
export default async function NewPasswordPage() {
  if (!(await isSignedInStaff())) redirect("/login?error=reset");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Set a new password</h1>
        <p className="text-muted">You&apos;ll use it the next time you sign in.</p>
      </div>
      <NewPasswordForm />
    </main>
  );
}
