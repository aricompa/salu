import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, buttonStyles } from "@/components/ui";
import { requireMembership } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { tableQrSvg } from "@/lib/qr";
import { canManage } from "@/lib/roles";
import { getTables } from "@/lib/tables";
import { PrintButton } from "../PrintButton";

export const metadata = { title: "Print QR codes · Salu" };

const PER_PAGE = 6;

/**
 * Print sheet: six cards per page, each with a high-error-correction QR at 45 mm
 * (the code itself stays above 3 cm), the table label, and "Scan to order".
 * Tokens are per-restaurant secrets, so floor staff get "Nothing here".
 */
export default async function PrintQrPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) notFound();
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;
  const tables = (await getTables(membership.restaurantId, { withTokens: true })).filter(
    (t) => t.is_active && t.qr_token,
  );
  const cards = await Promise.all(
    tables.map(async (t) => ({
      id: t.id,
      label: t.label,
      svg: await tableQrSvg(siteUrl, t.qr_token as string),
    })),
  );
  const pages: (typeof cards)[] = [];
  for (let i = 0; i < cards.length; i += PER_PAGE) pages.push(cards.slice(i, i + PER_PAGE));

  return (
    <div data-theme="light" className="flex flex-col gap-6 bg-surface p-6 text-text print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">QR codes</h1>
          <p className="text-muted">
            One card per active table, six to a page. Print at 100% scale so each code stays
            scannable.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/restaurant/tables" className={buttonStyles("ghost")}>
            Back to tables
          </Link>
          {cards.length > 0 && <PrintButton />}
        </div>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          title="No active tables"
          body="Add a table, or reactivate one, to print its code."
        />
      ) : (
        pages.map((page, index) => (
          <section
            key={index}
            aria-label={`Page ${index + 1}`}
            className="grid break-after-page grid-cols-2 gap-[6mm] last:break-after-auto"
          >
            {page.map((card) => (
              <article
                key={card.id}
                aria-label={`Table ${card.label}`}
                className="flex h-[80mm] break-inside-avoid flex-col items-center justify-center gap-[3mm] rounded-card border border-dashed border-border p-[4mm] text-center"
              >
                <p className="text-base font-medium">{membership.restaurantName}</p>
                <div
                  role="img"
                  aria-label={`QR code for table ${card.label}`}
                  className="size-[45mm] [&>svg]:size-full"
                  dangerouslySetInnerHTML={{ __html: card.svg }}
                />
                <p className="text-4xl font-bold">{card.label}</p>
                <p className="text-lg">Scan to order</p>
              </article>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
