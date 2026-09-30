import "server-only";
import { requireMembership, type Membership } from "@/lib/auth";
import { fail } from "@/lib/errors";
import { canManage } from "@/lib/roles";

/**
 * Membership for a Server Action that edits the menu, tables or settings. Floor
 * staff get not_allowed before any query runs; RLS still enforces it underneath.
 */
export async function managerMembership(): Promise<
  { ok: true; membership: Membership } | { ok: false; denied: ReturnType<typeof fail> }
> {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) return { ok: false, denied: fail("not_allowed") };
  return { ok: true, membership };
}
