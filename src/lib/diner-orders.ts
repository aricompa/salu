import "server-only";
import { createClient } from "@/lib/supabase/server";

/** The diner's newest order in this session that isn't finished (RLS: own orders only). */
export async function getActiveOrderId(sessionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("session_id", sessionId)
    .not("status", "in", "(served,cancelled)")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
