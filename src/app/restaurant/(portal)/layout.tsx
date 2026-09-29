import { PortalNav } from "@/components/portal/PortalNav";
import { Button } from "@/components/ui";
import { requireMembership } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { membership } = await requireMembership();

  return (
    <div data-theme="dark" className="min-h-dvh bg-surface text-lg text-text">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <p className="text-xl font-semibold">{membership.restaurantName}</p>
          <PortalNav />
        </div>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
