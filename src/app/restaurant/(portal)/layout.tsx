import { KitchenClock } from "@/components/portal/KitchenClock";
import { OfflineBanner } from "@/components/portal/OfflineBanner";
import { PortalNav } from "@/components/portal/PortalNav";
import { Button } from "@/components/ui";
import { requireMembership } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { membership } = await requireMembership();

  return (
    <div data-theme="dark" className="min-h-dvh bg-surface text-lg text-text print:bg-transparent">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4 print:hidden">
        <div className="flex flex-wrap items-center gap-6">
          <p className="text-xl font-semibold">{membership.restaurantName}</p>
          <PortalNav />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <KitchenClock timeZone={membership.restaurantTimezone} />
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <OfflineBanner />
      <main className="mx-auto max-w-5xl p-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
