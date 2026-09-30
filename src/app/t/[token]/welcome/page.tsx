import { notFound } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { qrTokenSchema } from "@/lib/validation/diner";
import { WelcomeGate } from "./WelcomeGate";

export const metadata = { title: "Welcome · Salu" };

/**
 * First scan on a device with no session. It can't name the restaurant or table yet:
 * join_table needs a signed-in user, and nothing lets a signed-out visitor look a token up
 * (rule 3). The menu header shows both one hop later.
 */
export default async function WelcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ retry?: string }>;
}) {
  const [{ token }, { retry }] = await Promise.all([params, searchParams]);
  if (!qrTokenSchema.safeParse(token).success) notFound();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-end gap-6 p-6 pb-16">
      <WelcomeGate
        token={token}
        siteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        failedBefore={retry === "1"}
      />
    </main>
  );
}
