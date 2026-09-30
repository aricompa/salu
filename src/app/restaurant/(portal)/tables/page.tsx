import Link from "next/link";
import { ActionButton, Badge, Card, EmptyState, buttonStyles } from "@/components/ui";
import { requireMembership } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { canManage } from "@/lib/roles";
import { tableUrl } from "@/lib/table-url";
import { getTables } from "@/lib/tables";
import { setTableActiveAction } from "./actions";
import { AddTableForm } from "./AddTableForm";
import { RotateQrButton } from "./RotateQrButton";
import { TableDetails } from "./TableDetails";
import { TableLink } from "./TableLink";

export const metadata = { title: "Tables · Salu" };

export default async function TablesPage() {
  const { membership } = await requireMembership();
  const manage = canManage(membership.role);
  const tables = await getTables(membership.restaurantId, { withTokens: manage });
  const inactive = tables.filter((t) => !t.is_active).length;
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Tables</h1>
          <p className="text-muted">
            {tables.length} {tables.length === 1 ? "table" : "tables"}
            {inactive > 0 && ` · ${inactive} inactive`}
          </p>
        </div>
        {manage && tables.length > inactive && (
          <Link href="/restaurant/tables/print" className={buttonStyles("primary")}>
            Print QR codes
          </Link>
        )}
      </div>

      {manage ? (
        <AddTableForm />
      ) : (
        <p className="text-muted">Owners and managers add tables and print QR codes.</p>
      )}

      {tables.length === 0 ? (
        <EmptyState
          title="No tables yet"
          body="Add one for each table diners sit at, like A1 or Patio 2. Each gets its own QR code."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {tables.map((table) => (
            <li key={table.id}>
              <Card
                className={
                  table.is_active ? "flex flex-col gap-3" : "flex flex-col gap-3 border-dashed"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <TableDetails
                    id={table.id}
                    label={table.label}
                    capacity={table.capacity}
                    manage={manage}
                  />
                  <Badge tone={table.is_active ? "success" : "neutral"}>
                    {table.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {!table.is_active && (
                  <p className="text-muted">
                    Its QR code shows diners that the table isn&apos;t active.
                  </p>
                )}
                {manage && table.qr_token && (
                  <>
                    <TableLink url={tableUrl(siteUrl, table.qr_token)} label={table.label} />
                    <div className="flex flex-wrap items-start gap-2">
                      <ActionButton
                        action={setTableActiveAction}
                        fields={{ id: table.id, active: String(!table.is_active) }}
                      >
                        {table.is_active ? "Deactivate" : "Reactivate"}{" "}
                        <span className="sr-only">{table.label}</span>
                      </ActionButton>
                      <RotateQrButton id={table.id} label={table.label} />
                    </div>
                  </>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
