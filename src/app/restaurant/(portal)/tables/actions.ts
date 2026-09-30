"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult, type AppError, type FormResult } from "@/lib/errors";
import { managerMembership } from "@/lib/portal-access";
import { createTable, rotateTableQr, updateTable } from "@/lib/tables";
import { fieldErrorsOf, uuidField } from "@/lib/validation/fields";
import { tableSchema } from "@/lib/validation/tables";

type ButtonResult = ActionResult<null> | null;
type TableField = "label" | "capacity";
export type TableFormResult = FormResult<null, TableField>;

const TABLES = "/restaurant/tables";

function revalidateTables() {
  revalidatePath(TABLES);
  revalidatePath(`${TABLES}/print`);
}

function readTableForm(formData: FormData) {
  return {
    label: String(formData.get("label") ?? ""),
    capacity: String(formData.get("capacity") ?? ""),
  };
}

/** A failed save, with a duplicate label shown on the field: "You already have a table called A4." */
function saveFailed(
  error: AppError,
  values: Record<TableField, string>,
): Exclude<TableFormResult, null> {
  return error.code === "label_taken"
    ? {
        ok: false,
        error,
        values,
        fieldErrors: { label: `You already have a table called ${values.label.trim()}.` },
      }
    : { ok: false, error, values };
}

export async function createTableAction(
  _prev: TableFormResult,
  formData: FormData,
): Promise<TableFormResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const values = readTableForm(formData);
  const parsed = tableSchema.safeParse(values);
  if (!parsed.success)
    return { ...fail("invalid_input"), values, fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await createTable(access.membership.restaurantId, parsed.data);
  if (!result.ok) return saveFailed(result.error, values);
  revalidateTables();
  return { ok: true, data: null };
}

export async function updateTableAction(
  _prev: TableFormResult,
  formData: FormData,
): Promise<TableFormResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const id = uuidField.safeParse(formData.get("id"));
  if (!id.success) return fail("not_found");
  const values = readTableForm(formData);
  const parsed = tableSchema.safeParse(values);
  if (!parsed.success)
    return { ...fail("invalid_input"), values, fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await updateTable(access.membership.restaurantId, id.data, parsed.data);
  if (!result.ok) return saveFailed(result.error, values);
  revalidateTables();
  return { ok: true, data: null };
}

/** Deactivate or reactivate. There is no delete: tables with history are never deleted (rule 5). */
export async function setTableActiveAction(
  _prev: ButtonResult,
  formData: FormData,
): Promise<ButtonResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const parsed = z
    .object({ id: uuidField, active: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return fail("invalid_input");

  const result = await updateTable(access.membership.restaurantId, parsed.data.id, {
    is_active: parsed.data.active === "true",
  });
  if (result.ok) revalidateTables();
  return result;
}

/** New QR token via rotate_table_qr(). Printed codes for the table stop working. */
export async function rotateTableQrAction(
  _prev: ButtonResult,
  formData: FormData,
): Promise<ButtonResult> {
  const access = await managerMembership();
  if (!access.ok) return access.denied;
  const id = uuidField.safeParse(formData.get("id"));
  if (!id.success) return fail("not_found");

  const result = await rotateTableQr(id.data);
  if (!result.ok) return result;
  revalidateTables();
  return { ok: true, data: null };
}
