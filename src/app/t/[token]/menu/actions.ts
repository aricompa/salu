"use server";

import { getDinerSession, setDisplayName } from "@/lib/diner";
import { fail, type ActionResult } from "@/lib/errors";
import { displayNameSchema } from "@/lib/validation/diner";

/**
 * Saves the name staff see on this diner's orders (PRD D2). The session comes from the
 * scan cookie, re-checked through RLS; the client only sends the name.
 */
export async function saveDisplayNameAction(name: unknown): Promise<ActionResult<null>> {
  const session = await getDinerSession();
  if (session.kind === "closed") return fail("session_closed");
  if (session.kind === "none") return fail("not_participant");
  const parsed = displayNameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: { code: "invalid_input", message: parsed.error.issues[0].message } };
  }
  return setDisplayName(session.table.sessionId, parsed.data);
}
