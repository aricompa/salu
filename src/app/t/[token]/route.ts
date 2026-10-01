import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { hasSession, joinTable, rememberTable } from "@/lib/diner";
import { qrTokenSchema } from "@/lib/validation/diner";

/**
 * The QR code's URL. A scan joins the table (join_table is the only diner entry point,
 * rule 3), remembers it for this token's pages, and opens the menu. Signed-out devices
 * go through the welcome page first; a table staff haven't seated yet goes to not-seated. This GET has side effects, so nothing links here
 * with a prefetching <Link>.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!qrTokenSchema.safeParse(token).success)
    redirect(`/t/${encodeURIComponent(token)}/unavailable`);
  if (!(await hasSession())) redirect(`/t/${token}/welcome`);

  const joined = await joinTable(token);
  if (!joined.ok) {
    redirect(
      joined.error.code === "invalid_table"
        ? `/t/${token}/unavailable`
        : joined.error.code === "table_not_open"
          ? `/t/${token}/not-seated`
          : `/t/${token}/welcome?retry=1`,
    );
  }
  await rememberTable(token, joined.data);
  redirect(`/t/${token}/menu`);
}
