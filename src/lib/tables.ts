import "server-only";
import type { TablesInsert } from "@/lib/db/types";
import { toAppError, type ActionResult } from "@/lib/errors";
import { oneRowChanged } from "@/lib/mutations";
import { createClient } from "@/lib/supabase/server";
import type { TableInput } from "@/lib/validation/tables";

export type DiningTable = {
  id: string;
  label: string;
  capacity: number | null;
  is_active: boolean;
  /** Only loaded for owners and managers. */
  qr_token: string | null;
};

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label, "en", { numeric: true, sensitivity: "base" });

/**
 * Tables for the portal. Tokens are read only when asked: RLS lets any member read
 * them, but floor staff never need them on screen.
 */
export async function getTables(
  restaurantId: string,
  { withTokens }: { withTokens: boolean },
): Promise<DiningTable[]> {
  const supabase = await createClient();
  if (withTokens) {
    const { data, error } = await supabase
      .from("dining_tables")
      .select("id, label, capacity, is_active, qr_token")
      .eq("restaurant_id", restaurantId);
    if (error) throw new Error(`Could not load tables: ${error.message}`);
    return data.sort(byLabel);
  }
  const { data, error } = await supabase
    .from("dining_tables")
    .select("id, label, capacity, is_active")
    .eq("restaurant_id", restaurantId);
  if (error) throw new Error(`Could not load tables: ${error.message}`);
  return data.map((t) => ({ ...t, qr_token: null })).sort(byLabel);
}

export async function createTable(
  restaurantId: string,
  input: TableInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  // qr_token is written by a trigger. Clients have no insert grant on it, so it is
  // left out here even though the generated Insert type lists it as required.
  const row = { restaurant_id: restaurantId, label: input.label, capacity: input.capacity };
  const { data, error } = await supabase
    .from("dining_tables")
    .insert(row as TablesInsert<"dining_tables">)
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: toAppError(error, { unique: "label_taken" }) };
  return { ok: true, data: { id: data.id } };
}

export async function updateTable(
  restaurantId: string,
  tableId: string,
  patch: { label?: string; capacity?: number | null; is_active?: boolean },
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  return oneRowChanged(
    await supabase
      .from("dining_tables")
      .update(patch)
      .eq("restaurant_id", restaurantId)
      .eq("id", tableId)
      .select("id"),
    { unique: "label_taken" },
  );
}

/** New token for a table. Printed codes with the old token stop working at once. */
export async function rotateTableQr(tableId: string): Promise<ActionResult<{ token: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rotate_table_qr", { p_table_id: tableId });
  if (error || !data) return { ok: false, error: toAppError(error) };
  return { ok: true, data: { token: data } };
}
