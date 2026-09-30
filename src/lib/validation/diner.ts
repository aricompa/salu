import { z } from "zod";

/** A table token as the database mints it: 32 lowercase hex characters (a uuid without dashes). */
export const qrTokenSchema = z.string().regex(/^[0-9a-f]{32}$/);

/** What the scan route remembers about the table the diner joined. Not secret, not trusted. */
export const dinerTableSchema = z.object({
  sessionId: z.uuid(),
  restaurantId: z.uuid(),
  restaurantName: z.string().min(1).max(120),
  tableLabel: z.string().min(1).max(40),
});

export type DinerTable = z.infer<typeof dinerTableSchema>;

export const DINER_COOKIE = "salu_table";

export function encodeDinerCookie(table: DinerTable): string {
  return encodeURIComponent(JSON.stringify(table));
}

/** A missing, garbled or tampered cookie reads as "no table" (RLS decides the rest). */
export function decodeDinerCookie(raw: string | undefined): DinerTable | null {
  if (!raw) return null;
  try {
    const parsed = dinerTableSchema.safeParse(JSON.parse(decodeURIComponent(raw)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
