import { Badge, Card } from "@/components/ui";
import { requireMembership } from "@/lib/auth";
import { getSetupCounts } from "@/lib/restaurants";

export const metadata = { title: "Dashboard · Salu" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function DashboardPage() {
  const { membership } = await requireMembership();
  const counts = await getSetupCounts(membership.restaurantId);

  const steps = [
    {
      label: "Add menu items",
      done: counts.menuItems > 0,
      detail:
        counts.menuItems > 0 ? plural(counts.menuItems, "item") : "Menu editor is coming next.",
    },
    {
      label: "Add tables and print QR codes",
      done: counts.tables > 0,
      detail:
        counts.tables > 0 ? plural(counts.tables, "table") : "Tables and QR codes are coming next.",
    },
    {
      label: "Place a test order",
      done: counts.orders > 0,
      detail:
        counts.orders > 0 ? plural(counts.orders, "order") : "Available once the diner flow ships.",
    },
  ];
  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Get set up</h1>
        <p className="text-muted">
          {completed} of {steps.length} done
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.label}>
            <Card className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xl font-medium">{step.label}</p>
                <p className="text-muted">{step.detail}</p>
              </div>
              <Badge tone={step.done ? "success" : "neutral"}>{step.done ? "Done" : "To do"}</Badge>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
