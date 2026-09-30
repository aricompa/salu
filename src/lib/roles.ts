import type { Database } from "@/lib/db/types";

export type MemberRole = Database["public"]["Enums"]["member_role"];

/**
 * Owners and managers edit the menu, tables and settings. Floor staff read, and
 * 86 items through set_item_availability(). UI convenience only: RLS is the boundary.
 */
export function canManage(role: MemberRole): boolean {
  return role === "owner" || role === "manager";
}
