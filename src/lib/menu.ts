import "server-only";
import type { Tables } from "@/lib/db/types";
import { fail, toAppError, type ActionResult } from "@/lib/errors";
import type { AddonLink } from "@/lib/menu-addons";
import { oneRowChanged, reorder } from "@/lib/mutations";
import { createClient } from "@/lib/supabase/server";
import type { ItemInput } from "@/lib/validation/menu";

export type MenuCategory = Pick<
  Tables<"menu_categories">,
  "id" | "name" | "sort_order" | "is_active"
>;
export type MenuItem = Pick<
  Tables<"menu_items">,
  | "id"
  | "category_id"
  | "name"
  | "description"
  | "price_cents"
  | "is_available"
  | "dietary_tags"
  | "sort_order"
  | "addon_only"
>;

const ITEM_COLUMNS =
  "id, category_id, name, description, price_cents, is_available, dietary_tags, sort_order, addon_only";

/**
 * The whole menu for the portal, including hidden categories and sold-out items, and
 * which add-ons go with which items.
 */
export async function getMenu(
  restaurantId: string,
): Promise<{ categories: MenuCategory[]; items: MenuItem[]; links: AddonLink[] }> {
  const supabase = await createClient();
  const [categories, items, links] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, sort_order, is_active")
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("menu_items")
      .select(ITEM_COLUMNS)
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .order("created_at"),
    supabase.from("menu_item_addons").select("item_id, addon_id").eq("restaurant_id", restaurantId),
  ]);
  if (categories.error) throw new Error(`Could not load categories: ${categories.error.message}`);
  if (items.error) throw new Error(`Could not load items: ${items.error.message}`);
  if (links.error) throw new Error(`Could not load add-ons: ${links.error.message}`);
  return { categories: categories.data, items: items.data, links: links.data };
}

export async function getItem(restaurantId: string, itemId: string): Promise<MenuItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select(ITEM_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new Error(`Could not load item: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------- categories

export async function createCategory(
  restaurantId: string,
  name: string,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("menu_categories")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("menu_categories")
    .insert({ restaurant_id: restaurantId, name, sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: toAppError(error) };
  return { ok: true, data: { id: data.id } };
}

export async function updateCategory(
  restaurantId: string,
  categoryId: string,
  patch: { name?: string; is_active?: boolean },
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  return oneRowChanged(
    await supabase
      .from("menu_categories")
      .update(patch)
      .eq("restaurant_id", restaurantId)
      .eq("id", categoryId)
      .select("id"),
  );
}

export async function moveCategory(
  restaurantId: string,
  categoryId: string,
  direction: "up" | "down",
): Promise<ActionResult<null>> {
  const { categories } = await getMenu(restaurantId);
  const supabase = await createClient();
  return reorder(categories, categoryId, direction, async (id, sortOrder) =>
    oneRowChanged(
      await supabase
        .from("menu_categories")
        .update({ sort_order: sortOrder })
        .eq("restaurant_id", restaurantId)
        .eq("id", id)
        .select("id"),
    ),
  );
}

/**
 * Deletes an empty category. A category with items is refused: `on delete set null`
 * would orphan them, and an item with no category never reaches the diner menu.
 */
export async function deleteCategory(
  restaurantId: string,
  categoryId: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("category_id", categoryId);
  if (error) return { ok: false, error: toAppError(error) };
  if ((count ?? 0) > 0) return fail("category_not_empty");
  return oneRowChanged(
    await supabase
      .from("menu_categories")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("id", categoryId)
      .select("id"),
  );
}

// ---------------------------------------------------------------- items

async function nextItemSortOrder(restaurantId: string, categoryId: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("menu_items")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1);
  query = categoryId ? query.eq("category_id", categoryId) : query.is("category_id", null);
  const { data } = await query.maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}

const itemRow = (input: ItemInput) => ({
  name: input.name,
  description: input.description,
  price_cents: input.price,
  category_id: input.categoryId,
  dietary_tags: input.dietaryTags,
  is_available: input.isAvailable,
  addon_only: input.addonOnly,
});

export async function createItem(
  restaurantId: string,
  input: ItemInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      restaurant_id: restaurantId,
      ...itemRow(input),
      sort_order: await nextItemSortOrder(restaurantId, input.categoryId),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: toAppError(error) };
  return { ok: true, data: { id: data.id } };
}

export async function updateItem(
  restaurantId: string,
  itemId: string,
  input: ItemInput,
): Promise<ActionResult<null>> {
  const current = await getItem(restaurantId, itemId);
  if (!current) return fail("not_found");
  const moved = current.category_id !== input.categoryId;
  const supabase = await createClient();
  return oneRowChanged(
    await supabase
      .from("menu_items")
      .update({
        ...itemRow(input),
        ...(moved ? { sort_order: await nextItemSortOrder(restaurantId, input.categoryId) } : {}),
      })
      .eq("restaurant_id", restaurantId)
      .eq("id", itemId)
      .select("id"),
  );
}

export async function moveItem(
  restaurantId: string,
  itemId: string,
  direction: "up" | "down",
): Promise<ActionResult<null>> {
  const { items } = await getMenu(restaurantId);
  const item = items.find((i) => i.id === itemId);
  if (!item) return fail("not_found");
  const siblings = items.filter((i) => i.category_id === item.category_id);
  const supabase = await createClient();
  return reorder(siblings, itemId, direction, async (id, sortOrder) =>
    oneRowChanged(
      await supabase
        .from("menu_items")
        .update({ sort_order: sortOrder })
        .eq("restaurant_id", restaurantId)
        .eq("id", id)
        .select("id"),
    ),
  );
}

/** Past orders keep their own name and price snapshot (order_items), so history is safe. */
export async function deleteItem(
  restaurantId: string,
  itemId: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  return oneRowChanged(
    await supabase
      .from("menu_items")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("id", itemId)
      .select("id"),
  );
}

/** 86 or un-86 an item. Any member may; this RPC is the only path floor staff have (rule 5). */
export async function setItemAvailability(
  itemId: string,
  available: boolean,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_item_availability", {
    p_item_id: itemId,
    p_available: available,
  });
  if (error) return { ok: false, error: toAppError(error) };
  return { ok: true, data: null };
}

/**
 * Which items an add-on goes with (ruled 2026-10-03). An add-on-only item keeps exactly
 * `goesWith` (regular items of this restaurant) and can't have add-ons of its own; a
 * regular item can't be anyone's add-on. Links that would never count are removed, so the
 * portal shows what diners get. Owners and managers only (RLS). `itemId` is a parsed uuid.
 */
export async function setAddonLinks(
  restaurantId: string,
  itemId: string,
  addonOnly: boolean,
  goesWith: readonly string[],
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const cleared = await supabase
    .from("menu_item_addons")
    .delete()
    .eq("restaurant_id", restaurantId)
    .or(addonOnly ? `item_id.eq.${itemId},addon_id.eq.${itemId}` : `addon_id.eq.${itemId}`);
  if (cleared.error) return fail("addon_links_failed");
  if (!addonOnly || goesWith.length === 0) return { ok: true, data: null };

  const { data: parents, error } = await supabase
    .from("menu_items")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("addon_only", false)
    .in("id", [...goesWith]);
  if (error) return fail("addon_links_failed");
  if (parents.length === 0) return { ok: true, data: null };

  const added = await supabase
    .from("menu_item_addons")
    .insert(parents.map((p) => ({ restaurant_id: restaurantId, item_id: p.id, addon_id: itemId })));
  // Any failure here (a concurrent save's duplicate included) leaves the item saved.
  if (added.error) return fail("addon_links_failed");
  return { ok: true, data: null };
}
