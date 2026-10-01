import Link from "next/link";
import { LiveRefresh } from "@/components/portal/useLiveRefresh";
import { Badge, Card } from "@/components/ui";
import { requireMembership } from "@/lib/auth";
import { getLiveCounts, getSetupCounts } from "@/lib/restaurants";
import { canManage } from "@/lib/roles";
import { getTables } from "@/lib/tables";
import { startOfDayIn } from "@/lib/time";

export const metadata = { title: "Dashboard · Salu" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type Step = {
  label: string;
  done: boolean;
  detail: string;
  /** A portal page (prefetching Link) or the scan URL (a plain <a>: it joins the table). */
  link: { href: string; plain?: boolean } | null;
};

export default async function DashboardPage() {
  const { membership } = await requireMembership();
  const manage = canManage(membership.role);
  const dayStart = startOfDayIn(membership.restaurantTimezone, new Date());
  const [counts, live, tables] = await Promise.all([
    getSetupCounts(membership.restaurantId),
    getLiveCounts(membership.restaurantId, dayStart),
    manage ? getTables(membership.restaurantId, { withTokens: true }) : Promise.resolve([]),
  ]);
  // Owners and managers only: floor staff never see QR tokens (Brief 02 builder call (e)).
  const testTable = tables.find((t) => t.is_active && t.qr_token);

  const steps: Step[] = [
    {
      label: "Add menu items",
      link: { href: "/restaurant/menu" },
      done: counts.menuItems > 0,
      detail: counts.menuItems > 0 ? plural(counts.menuItems, "item") : "Start with a category.",
    },
    {
      label: "Add tables and print QR codes",
      link: { href: "/restaurant/tables" },
      done: counts.tables > 0,
      detail: counts.tables > 0 ? plural(counts.tables, "table") : "One code per table.",
    },
    {
      label: "Place a test order",
      link: testTable?.qr_token ? { href: `/t/${testTable.qr_token}`, plain: true } : null,
      done: counts.orders > 0,
      detail:
        counts.orders > 0
          ? plural(counts.orders, "order")
          : testTable
            ? `Opens ${testTable.label} as a diner would. Seat it on the Orders page first.`
            : manage
              ? "Add a table first."
              : "An owner or manager places the first order.",
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  // Live once the first order is in (PRD P3); the checklist stays until every step is done.
  const isLive = counts.orders > 0;
  const setupDone = completed === steps.length;

  return (
    <div className="flex flex-col gap-8">
      {isLive && (
        <section aria-labelledby="today" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 id="today" className="text-3xl font-semibold">
              Today
            </h1>
            <LiveRefresh restaurantId={membership.restaurantId} />
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Card className="flex flex-col gap-1">
              <dt className="text-muted">Open tables</dt>
              <dd className="order-first text-4xl font-semibold">{live.openTables}</dd>
            </Card>
            <Card className="flex flex-col gap-1">
              <dt className="text-muted">Orders waiting</dt>
              <dd className="order-first text-4xl font-semibold">{live.ordersWaiting}</dd>
            </Card>
            <Card className="flex flex-col gap-1">
              <dt className="text-muted">
                Average time to serve
                <span className="block text-sm">
                  {live.servedToday > 0
                    ? `Sent to served, ${plural(live.servedToday, "order")} today`
                    : "Sent to served, today"}
                </span>
              </dt>
              <dd className="order-first text-4xl font-semibold">
                {live.averageServeMinutes === null ? "None yet" : `${live.averageServeMinutes} min`}
              </dd>
            </Card>
          </dl>
          <Link
            href="/restaurant/orders"
            className="inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline"
          >
            Open the order board
          </Link>
        </section>
      )}

      {!setupDone && (
        <section aria-labelledby="setup" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            {isLive ? (
              <h2 id="setup" className="text-2xl font-semibold">
                Get set up
              </h2>
            ) : (
              <h1 id="setup" className="text-3xl font-semibold">
                Get set up
              </h1>
            )}
            <p className="text-muted">
              {completed} of {steps.length} done
            </p>
          </div>
          <ol className="flex flex-col gap-3">
            {steps.map((step) => (
              <li key={step.label}>
                <Card className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xl font-medium">
                      {step.link === null ? (
                        step.label
                      ) : step.link.plain ? (
                        <a
                          href={step.link.href}
                          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                        >
                          {step.label}
                        </a>
                      ) : (
                        <Link
                          href={step.link.href}
                          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                        >
                          {step.label}
                        </Link>
                      )}
                    </p>
                    <p className="text-muted">{step.detail}</p>
                  </div>
                  <Badge tone={step.done ? "success" : "neutral"}>
                    {step.done ? "Done" : "To do"}
                  </Badge>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
