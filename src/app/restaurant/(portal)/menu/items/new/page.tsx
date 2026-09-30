import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { getMenu } from "@/lib/menu";
import { canManage } from "@/lib/roles";
import { ItemForm } from "../../ItemForm";

export const metadata = { title: "Add item · Salu" };

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) notFound();
  const [{ categories }, { category }] = await Promise.all([
    getMenu(membership.restaurantId),
    searchParams,
  ]);
  const preselected = categories.find((c) => c.id === category)?.id ?? categories[0]?.id ?? "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Add an item</h1>
      <ItemForm
        categories={categories}
        item={{
          id: null,
          name: "",
          description: "",
          price: "",
          categoryId: preselected,
          dietaryTags: [],
          isAvailable: true,
        }}
      />
    </div>
  );
}
