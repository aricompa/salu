import Link from "next/link";
import { ActionButton, Badge, Button, Card, ConfirmDialog, buttonStyles } from "@/components/ui";
import type { MenuCategory, MenuItem } from "@/lib/menu";
import { addonCounts, type AddonLink } from "@/lib/menu-addons";
import { formatCents } from "@/lib/money";
import { DIETARY_TAGS } from "@/lib/dietary";
import {
  deleteCategoryAction,
  deleteItemAction,
  moveCategoryAction,
  moveItemAction,
  setCategoryVisibleAction,
} from "./actions";
import { AvailabilityToggle } from "./AvailabilityToggle";
import { CategoryName } from "./CategoryName";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type Counts = ReturnType<typeof addonCounts>;

/**
 * The menu as the portal shows it. `manage` (owner or manager) adds the editing
 * controls; floor staff get the list and the 86 switch only. RLS is the real gate.
 */
export function MenuBoard({
  categories,
  items,
  links,
  manage,
  currency,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
  links: AddonLink[];
  manage: boolean;
  currency: string;
}) {
  const itemsIn = (categoryId: string | null) => items.filter((i) => i.category_id === categoryId);
  const counts = addonCounts(items, links);
  const uncategorised = itemsIn(null);
  return (
    <>
      <ol className="flex flex-col gap-4">
        {categories.map((category, index) => (
          <li key={category.id}>
            <CategorySection
              category={category}
              items={itemsIn(category.id)}
              first={index === 0}
              last={index === categories.length - 1}
              manage={manage}
              currency={currency}
              counts={counts}
            />
          </li>
        ))}
      </ol>
      {uncategorised.length > 0 && (
        <Card className="flex flex-col gap-3 border-dashed">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold">No category</h2>
            <p className="text-muted">
              Diners don&apos;t see these. {manage && "Edit each one to pick a category."}
            </p>
          </div>
          <ItemList items={uncategorised} manage={manage} currency={currency} counts={counts} />
        </Card>
      )}
    </>
  );
}

function CategorySection({
  category,
  items,
  first,
  last,
  manage,
  currency,
  counts,
}: {
  category: MenuCategory;
  items: MenuItem[];
  first: boolean;
  last: boolean;
  manage: boolean;
  currency: string;
  counts: Counts;
}) {
  const { id, name, is_active } = category;
  return (
    <Card className={is_active ? "flex flex-col gap-4" : "flex flex-col gap-4 border-dashed"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {manage ? (
            <CategoryName id={id} name={name} />
          ) : (
            <h2 className="text-2xl font-semibold">{name}</h2>
          )}
          {!is_active && <Badge>Hidden</Badge>}
          <span className="text-muted">{plural(items.length, "item")}</span>
        </div>
        {manage && (
          <div className="flex flex-wrap items-start gap-2">
            <ActionButton
              action={moveCategoryAction}
              fields={{ id, direction: "up" }}
              disabled={first}
            >
              Move up <span className="sr-only">{name}</span>
            </ActionButton>
            <ActionButton
              action={moveCategoryAction}
              fields={{ id, direction: "down" }}
              disabled={last}
            >
              Move down <span className="sr-only">{name}</span>
            </ActionButton>
            <ActionButton
              action={setCategoryVisibleAction}
              fields={{ id, visible: String(!is_active) }}
            >
              {is_active ? "Hide" : "Show"} <span className="sr-only">{name}</span>
            </ActionButton>
            {items.length === 0 ? (
              <ConfirmDialog
                triggerLabel="Delete"
                triggerContext={name}
                title={`Delete ${name}?`}
                body="It has no items. This can't be undone."
                confirmLabel="Delete category"
                action={deleteCategoryAction}
                fields={{ id }}
              />
            ) : (
              <div className="flex flex-col items-start gap-1">
                <Button variant="secondary" disabled aria-describedby={`delete-hint-${id}`}>
                  Delete <span className="sr-only">{name}</span>
                </Button>
                <p id={`delete-hint-${id}`} className="text-sm text-muted">
                  Move or delete its items first.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {!is_active && <p className="text-muted">Hidden from diners. Its items stay here.</p>}
      {items.length === 0 ? (
        <p className="text-muted">No items yet.</p>
      ) : (
        <ItemList items={items} manage={manage} currency={currency} counts={counts} />
      )}
      {manage && (
        <Link
          href={`/restaurant/menu/items/new?category=${id}`}
          className={buttonStyles("ghost", "self-start")}
        >
          Add item <span className="sr-only">to {name}</span>
        </Link>
      )}
    </Card>
  );
}

function ItemList({
  items,
  manage,
  currency,
  counts,
}: {
  items: MenuItem[];
  manage: boolean;
  currency: string;
  counts: Counts;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item, index) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-xl font-medium">{item.name}</p>
            <div className="flex flex-wrap items-center gap-2 text-muted">
              <span>{formatCents(item.price_cents, currency)}</span>
              {item.dietary_tags.map((tag) => {
                const known = DIETARY_TAGS.find((t) => t.value === tag);
                return (
                  <span
                    key={tag}
                    className="rounded-chip border border-border px-2 text-sm text-text"
                  >
                    <span aria-hidden="true">{known?.short ?? tag}</span>
                    <span className="sr-only">{known?.label ?? tag}</span>
                  </span>
                );
              })}
              {!item.is_available && <Badge tone="danger">Sold out</Badge>}
              {item.addon_only && <Badge>Add-on</Badge>}
            </div>
            <AddonLine item={item} counts={counts} />
            {item.description && <p className="line-clamp-2 text-muted">{item.description}</p>}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <AvailabilityToggle
              itemId={item.id}
              itemName={item.name}
              available={item.is_available}
            />
            {manage && (
              <>
                <Link
                  href={`/restaurant/menu/items/${item.id}`}
                  className={buttonStyles("secondary")}
                >
                  Edit <span className="sr-only">{item.name}</span>
                </Link>
                <ActionButton
                  action={moveItemAction}
                  fields={{ id: item.id, direction: "up" }}
                  disabled={index === 0}
                >
                  Up <span className="sr-only">{item.name}</span>
                </ActionButton>
                <ActionButton
                  action={moveItemAction}
                  fields={{ id: item.id, direction: "down" }}
                  disabled={index === items.length - 1}
                >
                  Down <span className="sr-only">{item.name}</span>
                </ActionButton>
                <ConfirmDialog
                  triggerLabel="Delete"
                  triggerContext={item.name}
                  title={`Delete ${item.name}?`}
                  body="Past orders keep their copy of the name and price."
                  confirmLabel="Delete item"
                  action={deleteItemAction}
                  fields={{ id: item.id }}
                />
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** What diners get: where an add-on is offered, or how many add-ons an item offers. */
function AddonLine({ item, counts }: { item: MenuItem; counts: Counts }) {
  if (item.addon_only) {
    const n = counts.goesWith.get(item.id) ?? 0;
    return (
      <p className={n === 0 ? "text-warning" : "text-muted"}>
        {n === 0
          ? "Not offered yet: edit it to pick the items it goes with."
          : `Offered with ${plural(n, "item")}`}
      </p>
    );
  }
  const n = counts.offers.get(item.id) ?? 0;
  return n > 0 ? <p className="text-muted">{plural(n, "add-on")}</p> : null;
}
