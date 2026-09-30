import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";

/**
 * Browser client (publishable key only). Use from Client Components.
 * The values are inlined at build time and validated with zod at server boot
 * (src/instrumentation.ts), so the browser only checks they exist: shipping zod to every
 * diner page cost 87 KB gzip against a 150 KB budget (PRD 5.9).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase URL or publishable key is missing");
  return createBrowserClient<Database>(url, key);
}
