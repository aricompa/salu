import "server-only";
import { cookies } from "next/headers";
import { toAppError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  DINER_COOKIE,
  decodeDinerCookie,
  encodeDinerCookie,
  type DinerTable,
} from "@/lib/validation/diner";

export type { DinerTable };

/** True when the request carries any Supabase user (a diner is anonymous; staff may test). */
export async function hasSession(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return !error && typeof data?.claims?.sub === "string";
}

/** join_table: the only diner entry point (rule 3). Opens or joins the table's open session. */
export async function joinTable(token: string): Promise<ActionResult<DinerTable>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_table", { p_qr_token: token });
  const row = data?.[0];
  if (error || !row) return { ok: false, error: toAppError(error) };
  return {
    ok: true,
    data: {
      sessionId: row.session_id,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_name,
      tableLabel: row.table_label,
    },
  };
}

/** Remembers the joined table for this token's pages only (path-scoped, httpOnly). */
export async function rememberTable(token: string, table: DinerTable): Promise<void> {
  (await cookies()).set(DINER_COOKIE, encodeDinerCookie(table), {
    path: `/t/${token}`,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
}

export type DinerSession =
  { kind: "open"; table: DinerTable } | { kind: "closed"; table: DinerTable } | { kind: "none" };

/**
 * The table this diner joined by scanning, re-checked through RLS on every render
 * (rule A1). "none" covers signed out, no cookie, or a session they are not seated in.
 */
export async function getDinerSession(): Promise<DinerSession> {
  const table = decodeDinerCookie((await cookies()).get(DINER_COOKIE)?.value);
  if (!table || !(await hasSession())) return { kind: "none" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("table_sessions")
    .select("id, status, restaurant_id")
    .eq("id", table.sessionId)
    .maybeSingle();
  if (error || !data || data.restaurant_id !== table.restaurantId) return { kind: "none" };
  return data.status === "open" ? { kind: "open", table } : { kind: "closed", table };
}
