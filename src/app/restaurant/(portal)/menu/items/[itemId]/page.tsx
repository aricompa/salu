import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { getItem, getMenu } from "@/lib/menu";
import { canManage } from "@/lib/roles";
import { centsToPriceInput } from "@/lib/validation/menu";
import { uuidField } from "@/lib/validation/fields";
import { ItemForm } from "../../ItemForm";

export const metadata = { title: "Edit item · Salu" };

export default async function EditItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) notFound();
  const id = uuidField.safeParse((await params).itemId);
  if (!id.success) notFound();
  const [item, { categories }] = await Promise.all([
    getItem(membership.restaurantId, id.data),
    getMenu(membership.restaurantId),
  ]);
  if (!item) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Edit {item.name}</h1>
      <ItemForm
        categories={categories}
        item={{
          id: item.id,
          name: item.name,
          description: item.description ?? "",
          price: centsToPriceInput(item.price_cents),
          categoryId: item.category_id ?? "",
          dietaryTags: item.dietary_tags,
          isAvailable: item.is_available,
        }}
      />
    </div>
  );
}
