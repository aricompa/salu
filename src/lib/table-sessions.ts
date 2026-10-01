import "server-only";
import { toAppError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type SeatingTable = { id: string; label: string; sessionId: string | null };

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label, "en", { numeric: true, sensitivity: "base" });

/** Every active table with its open session, if seated (members only, through RLS). */
export async function getSeatingTables(restaurantId: string): Promise<SeatingTable[]> {
  const supabase = await createClient();
  const [tables, sessions] = await Promise.all([
    supabase
      .from("dining_tables")
      .select("id, label")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true),
    supabase
      .from("table_sessions")
      .select("id, table_id")
      .eq("restaurant_id", restaurantId)
      .eq("status", "open"),
  ]);
  if (tables.error) throw new Error(`Could not load tables: ${tables.error.message}`);
  if (sessions.error) throw new Error(`Could not load sessions: ${sessions.error.message}`);
  const open = new Map(sessions.data.map((s) => [s.table_id, s.id]));
  return tables.data
    .map((t) => ({ id: t.id, label: t.label, sessionId: open.get(t.id) ?? null }))
    .sort(byLabel);
}

/** open_table_session: staff seat a table so its code takes orders. Any member may. */
export async function seatTable(tableId: string): Promise<ActionResult<{ sessionId: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_table_session", { p_table_id: tableId });
  if (error || !data) return { ok: false, error: toAppError(error) };
  return { ok: true, data: { sessionId: data } };
}

/**
 * close_table_session: the party has left. Diners learn it on their next action (PRD D10,
 * ruled 2026-09-30); with seating on, the table must be seated again before it orders.
 */
export async function closeTableSession(sessionId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_table_session", { p_session_id: sessionId });
  if (error) return { ok: false, error: toAppError(error) };
  return { ok: true, data: null };
}
