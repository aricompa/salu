import Link from "next/link";
import { EmptyState, buttonStyles } from "@/components/ui";
import { requireMembership } from "@/lib/auth";
import { getMenu } from "@/lib/menu";
import { canManage } from "@/lib/roles";
import { AddCategoryForm } from "./AddCategoryForm";
import { MenuBoard } from "./MenuBoard";

export const metadata = { title: "Menu · Salu" };

export default async function MenuPage() {
  const { membership } = await requireMembership();
  const manage = canManage(membership.role);
  const { categories, items } = await getMenu(membership.restaurantId);
  const soldOut = items.filter((i) => !i.is_available).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Menu</h1>
          <p className="text-muted">
            {categories.length} {categories.length === 1 ? "category" : "categories"} ·{" "}
            {items.length} {items.length === 1 ? "item" : "items"}
            {soldOut > 0 && ` · ${soldOut} sold out`}
          </p>
        </div>
        {manage && categories.length > 0 && (
          <Link href="/restaurant/menu/items/new" className={buttonStyles("primary")}>
            Add item
          </Link>
        )}
      </div>

      {manage ? (
        <AddCategoryForm />
      ) : (
        <p className="text-muted">
          You can mark items sold out here. Owners and managers edit the menu.
        </p>
      )}

      {categories.length === 0 && items.length === 0 ? (
        <EmptyState
          title={manage ? "Start with a category, then add items to it." : "The menu is empty."}
          body={
            manage
              ? "Categories are the tabs diners scroll through, like Starters or Drinks."
              : "An owner or manager adds the menu here."
          }
        />
      ) : (
        <MenuBoard
          categories={categories}
          items={items}
          manage={manage}
          currency={membership.restaurantCurrency}
        />
      )}
    </div>
  );
}
