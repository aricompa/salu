"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/errors";
import { setOrderStatus } from "@/lib/orders";
import { uuidField } from "@/lib/validation/fields";

type ButtonResult = ActionResult<null> | null;

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
  if (result.ok) {
    revalidatePath("/restaurant/orders");
    revalidatePath("/restaurant/dashboard");
  }
  return result;
}
