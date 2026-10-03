import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { ERROR_COPY } from "@/lib/errors";
import { getItem, getMenu } from "@/lib/menu";
import { addonFormFields } from "@/lib/menu-addons";
import { canManage } from "@/lib/roles";
import { centsToPriceInput } from "@/lib/validation/menu";
import { uuidField } from "@/lib/validation/fields";
import { ItemForm } from "../../ItemForm";

export const metadata = { title: "Edit item · Salu" };

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ links?: string | string[] }>;
}) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) notFound();
  const id = uuidField.safeParse((await params).itemId);
  if (!id.success) notFound();
  const [item, { categories, items, links }, { links: linkState }] = await Promise.all([
    getItem(membership.restaurantId, id.data),
    getMenu(membership.restaurantId),
    searchParams,
  ]);
  if (!item) notFound();
  const addons = addonFormFields(categories, items, links, item.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Edit {item.name}</h1>
      <ItemForm
        categories={categories}
        goesWithGroups={addons.groups}
        offers={addons.offers}
        notice={linkState === "failed" ? ERROR_COPY.addon_links_failed : undefined}
        item={{
          id: item.id,
          name: item.name,
          description: item.description ?? "",
          price: centsToPriceInput(item.price_cents),
          categoryId: item.category_id ?? "",
          dietaryTags: item.dietary_tags,
          isAvailable: item.is_available,
          addonOnly: item.addon_only,
          goesWith: addons.goesWith,
        }}
      />
    </div>
  );
}
