"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/components/ui/cn";
import { MAX_LINE_ADDONS, MAX_LINE_NOTES, addLine, cartStorageKey, cartTotals } from "@/lib/cart";
import { formatCents } from "@/lib/money";
import { CategoryTabs } from "./CategoryTabs";
import { DietaryChips } from "./DietaryChips";
import { scriptFont } from "./script-font";
import { useCart } from "./useCart";

export type MenuViewAddon = {
  id: string;
  name: string;
  price_cents: number;
  is_available: boolean;
};
export type MenuViewItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_available: boolean;
  dietary_tags: string[];
  addons: MenuViewAddon[];
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
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState("");
  const totals = cartTotals(cart ?? []);
  const money = (cents: number) => formatCents(cents, currency);

  const pickedAddons = (open?.addons ?? []).filter((a) => a.is_available && picked.has(a.id));
  const unitCents = (open?.price_cents ?? 0) + pickedAddons.reduce((n, a) => n + a.price_cents, 0);

  const openItem = (item: MenuViewItem) => {
    setQuantity(1);
    setNotes("");
    setPicked(new Set());
    setOpen(item);
  };
  const toggleAddon = (id: string, on: boolean) =>
    setPicked((current) => {
      if (on && current.size >= MAX_LINE_ADDONS) return current;
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const add = () => {
    if (!open) return;
    updateCart((c) =>
      addLine(c, {
        itemId: open.id,
        name: open.name,
        priceCents: open.price_cents,
        quantity,
        notes,
        addons: pickedAddons.map((a) => ({
          itemId: a.id,
          name: a.name,
          priceCents: a.price_cents,
        })),
      }),
    );
    const extras =
      pickedAddons.length > 0 ? ` with ${listNames(pickedAddons.map((a) => a.name))}` : "";
    setAdded(`Added ${quantity} ${open.name}${extras}.`);
    setOpen(null);
  };

  return (
    <>
      <CategoryTabs categories={categories} />
      <div className={cn("flex flex-col gap-6 pt-4 pb-32", scriptFont.variable)}>
        {categories.map((category) => (
          <section
            key={category.id}
            id={`section-${category.id}`}
            aria-labelledby={`heading-${category.id}`}
            className="scroll-mt-20"
          >
            <h2
              id={`heading-${category.id}`}
              className="mb-1 font-script text-[3.25rem] leading-tight font-normal"
            >
              {category.name}
            </h2>
            {/* One rounded panel per section: rows with hairline dividers, no card borders. */}
            <ul className="flex flex-col divide-y divide-text/12 rounded-[1.375rem] bg-surface-raised px-4">
              {category.items.map((item) => (
                <li key={item.id}>
                  {item.is_available ? (
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="flex w-full items-center gap-3 py-4 text-left"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <ItemSummary item={item} price={money(item.price_cents)} />
                      </span>
                      {/* The whole row is the button; the + only shows it adds. */}
                      <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-pop text-2xl leading-none font-semibold text-on-pop"
                      >
                        +
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1.5 py-4 text-muted">
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
            {open.addons.length > 0 && (
              <AddonPicker
                addons={open.addons}
                picked={picked}
                onToggle={toggleAddon}
                price={money}
              />
            )}
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
              Add · {money(unitCents * quantity)}
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

/** "A", "A and B", "A, B and C". */
function listNames(names: string[]): string {
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The item's linked add-ons as checkboxes, each with its price. One of each per unit:
 * they follow the quantity. A sold-out add-on stays listed, disabled, with its badge.
 * At place_order's limit of 10, the rest wait until one is unticked.
 */
function AddonPicker({
  addons,
  picked,
  onToggle,
  price,
}: {
  addons: MenuViewAddon[];
  picked: ReadonlySet<string>;
  onToggle: (id: string, on: boolean) => void;
  price: (cents: number) => string;
}) {
  const full = addons.filter((a) => a.is_available && picked.has(a.id)).length >= MAX_LINE_ADDONS;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-lg font-semibold">Add-ons</legend>
      <p className="mb-1 text-sm text-muted">Optional. They go on each one you add.</p>
      {full && (
        <p className="text-sm text-muted">That&apos;s {MAX_LINE_ADDONS}, the most for one item.</p>
      )}
      {addons.map((addon) => (
        <label
          key={addon.id}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-card px-1",
            !addon.is_available && "text-muted",
          )}
        >
          <input
            type="checkbox"
            checked={addon.is_available && picked.has(addon.id)}
            disabled={!addon.is_available || (full && !picked.has(addon.id))}
            onChange={(e) => onToggle(addon.id, e.target.checked)}
            className="size-5 shrink-0 accent-brand"
          />
          <span className="flex-1">{addon.name}</span>
          {addon.is_available ? (
            <span className="font-medium">+{price(addon.price_cents)}</span>
          ) : (
            <Badge tone="danger">Sold out</Badge>
          )}
        </label>
      ))}
    </fieldset>
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
        <span className="text-[0.9375rem] font-bold tracking-[0.03em] uppercase">{item.name}</span>
        <span className="font-bold">{price}</span>
      </span>
      {item.description && <span className="line-clamp-2 text-muted">{item.description}</span>}
      {(item.dietary_tags.length > 0 || soldOut) && (
        <span className="flex flex-wrap items-center gap-2">
          <DietaryChips tags={item.dietary_tags} />
          {soldOut && <Badge tone="danger">Sold out</Badge>}
        </span>
      )}
    </>
  );
}
