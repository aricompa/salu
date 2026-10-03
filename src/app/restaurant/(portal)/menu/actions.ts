"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import { fail, type ActionResult, type FormResult } from "@/lib/errors";
import {
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  moveCategory,
  moveItem,
  setAddonLinks,
  setItemAvailability,
  updateCategory,
  updateItem,
} from "@/lib/menu";
import { managerMembership } from "@/lib/portal-access";
import { fieldErrorsOf, uuidField } from "@/lib/validation/fields";
import { categorySchema, itemFormValues, itemSchema, moveSchema } from "@/lib/validation/menu";

type ButtonResult = ActionResult<null> | null;
const MENU = "/restaurant/menu";

const idOf = (formData: FormData) => uuidField.safeParse(formData.get("id"));

// ---------------------------------------------------------------- categories

export type CategoryFormResult = FormResult<null, "name">;

export async function createCategoryAction(
  _prev: CategoryFormResult,
  formData: FormData,
): Promise<CategoryFormResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const values = { name: String(formData.get("name") ?? "") };
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success)
    return { ...fail("invalid_input"), values, fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await createCategory(access.membership.restaurantId, parsed.data.name);
  if (!result.ok) return { ok: false, error: result.error, values };
  revalidatePath(MENU);
  return { ok: true, data: null };
}

export async function renameCategoryAction(
  _prev: CategoryFormResult,
  formData: FormData,
): Promise<CategoryFormResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const id = idOf(formData);
  if (!id.success) return fail("not_found");
  const values = { name: String(formData.get("name") ?? "") };
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success)
    return { ...fail("invalid_input"), values, fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await updateCategory(access.membership.restaurantId, id.data, {
    name: parsed.data.name,
  });
  if (!result.ok) return { ok: false, error: result.error, values };
  revalidatePath(MENU);
  return { ok: true, data: null };
}

export async function setCategoryVisibleAction(
  _prev: ButtonResult,
  formData: FormData,
): Promise<ButtonResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const parsed = z
    .object({ id: uuidField, visible: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), visible: formData.get("visible") });
  if (!parsed.success) return fail("invalid_input");

  const result = await updateCategory(access.membership.restaurantId, parsed.data.id, {
    is_active: parsed.data.visible === "true",
  });
  if (result.ok) revalidatePath(MENU);
  return result;
}

export async function moveCategoryAction(
  _prev: ButtonResult,
  formData: FormData,
): Promise<ButtonResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const parsed = moveSchema.safeParse({
    id: formData.get("id"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return fail("invalid_input");

  const result = await moveCategory(
    access.membership.restaurantId,
    parsed.data.id,
    parsed.data.direction,
  );
  if (result.ok) revalidatePath(MENU);
  return result;
}

export async function deleteCategoryAction(
  _prev: ButtonResult,
  formData: FormData,
): Promise<ButtonResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const id = idOf(formData);
  if (!id.success) return fail("not_found");

  const result = await deleteCategory(access.membership.restaurantId, id.data);
  if (result.ok) revalidatePath(MENU);
  return result;
}

// ---------------------------------------------------------------- items

type ItemField =
  | "name"
  | "description"
  | "price"
  | "categoryId"
  | "dietaryTags"
  | "isAvailable"
  | "addonOnly"
  | "goesWith";
export type ItemFormResult = FormResult<null, ItemField>;

/**
 * Create (no id) or update (id) an item and the items it goes with as an add-on, then
 * return to the menu.
 */
export async function saveItemAction(
  _prev: ItemFormResult,
  formData: FormData,
): Promise<ItemFormResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const rawId = String(formData.get("id") ?? "");
  const id = rawId === "" ? null : uuidField.safeParse(rawId);
  if (id && !id.success) return fail("not_found");

  const raw = itemFormValues(formData);
  const values = {
    name: raw.name,
    description: raw.description,
    price: raw.price,
    categoryId: raw.categoryId,
    dietaryTags: raw.dietaryTags.join(","),
    isAvailable: raw.isAvailable ? "on" : "",
    addonOnly: raw.addonOnly ? "on" : "",
    goesWith: raw.goesWith.join(","),
  };
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ...fail("invalid_input"),
      values,
      fieldErrors: fieldErrorsOf<ItemField>(parsed.error),
    };

  const restaurantId = access.membership.restaurantId;
  const saved = id
    ? await updateItem(restaurantId, id.data, parsed.data)
    : await createItem(restaurantId, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error, values };
  const itemId = id ? id.data : (saved.data as { id: string }).id;
  const linked = await setAddonLinks(
    restaurantId,
    itemId,
    parsed.data.addonOnly,
    parsed.data.goesWith,
  );
  revalidatePath(MENU);
  // The item is saved either way; a new one is edited from here on so a retry can't copy it.
  if (!linked.ok) {
    if (!id) redirect(`${MENU}/items/${itemId}?links=failed`);
    return { ok: false, error: linked.error, values };
  }
  redirect(MENU);
}

export async function moveItemAction(
  _prev: ButtonResult,
  formData: FormData,
): Promise<ButtonResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const parsed = moveSchema.safeParse({
    id: formData.get("id"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return fail("invalid_input");

  const result = await moveItem(
    access.membership.restaurantId,
    parsed.data.id,
    parsed.data.direction,
  );
  if (result.ok) revalidatePath(MENU);
  return result;
}

export async function deleteItemAction(
  _prev: ButtonResult,
  formData: FormData,
): Promise<ButtonResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const id = idOf(formData);
  if (!id.success) return fail("not_found");

  const result = await deleteItem(access.membership.restaurantId, id.data);
  if (result.ok) revalidatePath(MENU);
  return result;
}

/**
 * 86 toggle. Any member, including floor staff, through set_item_availability()
 * (rule 5): never a direct table update, since floor staff have no update grant.
 */
export async function setItemAvailabilityAction(
  itemId: string,
  available: boolean,
): Promise<ActionResult<null>> {
  await requireMembership();
  const parsed = z.object({ itemId: uuidField, available: z.boolean() }).safeParse({
    itemId,
    available,
  });
  if (!parsed.success) return fail("invalid_input");

  const result = await setItemAvailability(parsed.data.itemId, parsed.data.available);
  if (result.ok) revalidatePath(MENU);
  return result;
}
