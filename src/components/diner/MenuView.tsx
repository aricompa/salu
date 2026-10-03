"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/components/ui/cn";
import { MAX_LINE_NOTES, addLine, cartStorageKey, cartTotals } from "@/lib/cart";
import { formatCents } from "@/lib/money";
import { CategoryTabs } from "./CategoryTabs";
import { DietaryChips } from "./DietaryChips";
import { useCart } from "./useCart";

/** Categories rotate through the brand accents: a tinted heading pill and a matching card stripe. */
const CATEGORY_COLOURS = [
  { heading: "bg-accent-1-soft", stripe: "border-l-accent-1" },
  { heading: "bg-accent-2-soft", stripe: "border-l-accent-2" },
  { heading: "bg-accent-3-soft", stripe: "border-l-accent-3" },
  { heading: "bg-accent-4-soft", stripe: "border-l-accent-4" },
] as const;

export type MenuViewItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_available: boolean;
  dietary_tags: string[];
};
export type MenuViewCategory = { id: string; name: string; items: MenuViewItem[] };

/** The diner menu: tabs, item cards, the item sheet, and the cart bar (PRD D3, D4). */
export function MenuView({
  token,
  sessionId,
  currency,
  categories,
}: {
  token: string;
  sessionId: string;
  currency: string;
  categories: MenuViewCategory[];
}) {
  const [cart, updateCart] = useCart(cartStorageKey(token, sessionId));
  const [open, setOpen] = useState<MenuViewItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState("");
  const totals = cartTotals(cart ?? []);
  const money = (cents: number) => formatCents(cents, currency);

  const openItem = (item: MenuViewItem) => {
    setQuantity(1);
    setNotes("");
    setOpen(item);
  };
  const add = () => {
    if (!open) return;
    updateCart((c) =>
      addLine(c, {
        itemId: open.id,
        name: open.name,
        priceCents: open.price_cents,
        quantity,
        notes,
      }),
    );
    setAdded(`Added ${quantity} ${open.name}.`);
    setOpen(null);
  };

  return (
    <>
      <CategoryTabs categories={categories} />
      <div className="flex flex-col gap-8 pt-4 pb-32">
        {categories.map((category, index) => (
          <section
            key={category.id}
            id={`section-${category.id}`}
            aria-labelledby={`heading-${category.id}`}
            className="scroll-mt-20"
          >
            <h2
              id={`heading-${category.id}`}
              className={cn(
                "mb-3 w-fit rounded-chip px-3.5 py-0.5 text-2xl font-semibold text-on-accent",
                CATEGORY_COLOURS[index % CATEGORY_COLOURS.length].heading,
              )}
            >
              {category.name}
            </h2>
            <ul className="flex flex-col gap-3">
              {category.items.map((item) => (
                <li key={item.id}>
                  {item.is_available ? (
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={cn(
                        "flex w-full flex-col gap-1.5 rounded-card border border-l-[6px] border-border bg-surface-raised p-4 text-left",
                        CATEGORY_COLOURS[index % CATEGORY_COLOURS.length].stripe,
                      )}
                    >
                      <ItemSummary item={item} price={money(item.price_cents)} />
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1.5 rounded-card border border-dashed border-border p-4 text-muted">
                      <ItemSummary item={item} price={money(item.price_cents)} soldOut />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.name ?? ""}>
        {open && (
          <div className="mt-3 flex flex-col gap-4">
            {open.description && <p className="text-muted">{open.description}</p>}
            <DietaryChips tags={open.dietary_tags} />
            <Stepper label="Quantity" context={open.name} value={quantity} onChange={setQuantity} />
            <Textarea
              label="Notes for the kitchen"
              hint="Optional, like no onions."
              maxLength={MAX_LINE_NOTES}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-16"
            />
            <Button onClick={add} className="w-full">
              Add · {money(open.price_cents * quantity)}
            </Button>
          </div>
        )}
      </Sheet>

      <p role="status" className="sr-only">
        {added}
      </p>
      {totals.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 p-4 backdrop-blur">
          <Link
            href={`/t/${token}/cart`}
            className={buttonStyles("primary", "mx-auto w-full max-w-2xl justify-between")}
          >
            <span>
              {totals.count} {totals.count === 1 ? "item" : "items"} · {money(totals.subtotalCents)}
            </span>
            <span>View order</span>
          </Link>
        </div>
      )}
    </>
  );
}

function ItemSummary({
  item,
  price,
  soldOut = false,
}: {
  item: MenuViewItem;
  price: string;
  soldOut?: boolean;
}) {
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="text-lg font-semibold">{item.name}</span>
        <span className="font-medium">{price}</span>
      </span>
      {item.description && <span className="line-clamp-2 text-muted">{item.description}</span>}
      <span className="flex flex-wrap items-center gap-2">
        <DietaryChips tags={item.dietary_tags} />
        {soldOut && <Badge tone="danger">Sold out</Badge>}
      </span>
    </>
  );
}
