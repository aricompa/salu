"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/errors";
import { setOrderStatus } from "@/lib/orders";
import { closeTableSession, seatTable } from "@/lib/table-sessions";
import { uuidField } from "@/lib/validation/fields";

type ButtonResult = ActionResult<null> | null;

function revalidateBoard() {
  revalidatePath("/restaurant/orders");
  revalidatePath("/restaurant/dashboard");
}

const statusChange = z.object({
  id: uuidField,
  to: z.enum(["accepted", "preparing", "ready", "served", "cancelled"]),
});

/**
 * Moves an order one step or cancels it. Any member may, floor staff included; the
 * database trigger decides whether the move is allowed (rule 5, status only).
 */
export async function setOrderStatusAction(
  _prev: ButtonResult,
  formData: FormData,
): Promise<ButtonResult> {
  const { membership } = await requireMembership();
  const parsed = statusChange.safeParse({ id: formData.get("id"), to: formData.get("to") });
  if (!parsed.success) return fail("invalid_input");

  const result = await setOrderStatus(membership.restaurantId, parsed.data.id, parsed.data.to);
  if (result.ok) revalidateBoard();
  return result;
}

/** Seats a table so its code takes orders (prank protection). Any member may. */
export async function seatTableAction(
  _prev: ButtonResult,
  formData: FormData,
): Promise<ButtonResult> {
  await requireMembership();
  const id = uuidField.safeParse(formData.get("id"));
  if (!id.success) return fail("not_found");
  const result = await seatTable(id.data);
  if (!result.ok) return result;
  revalidateBoard();
  return { ok: true, data: null };
}

/** Closes a seated table's session. Its orders stay on the board until served or cancelled. */
export async function closeTableAction(
  _prev: ButtonResult,
  formData: FormData,
): Promise<ButtonResult> {
  await requireMembership();
  const id = uuidField.safeParse(formData.get("sessionId"));
  if (!id.success) return fail("not_found");
  const result = await closeTableSession(id.data);
  if (result.ok) revalidateBoard();
  return result;
}
