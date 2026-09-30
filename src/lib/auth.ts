import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/roles";
import { isStaffClaims } from "@/lib/staff-claims";

export type { MemberRole };

export type StaffUser = { userId: string; email: string | null };

export type Membership = {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  restaurantTimezone: string;
  restaurantCurrency: string;
  role: MemberRole;
};

/**
 * Verifies the caller on the server with getClaims() (never getSession()).
 * Anonymous diners and signed-out visitors are sent to /login.
 */
export async function requireStaff(): Promise<StaffUser> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !isStaffClaims(claims)) redirect("/login");
  return { userId: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

/** Returns the caller's membership, or null if they have no restaurant yet. */
export async function getMembership(
  userId: string,
  restaurantId?: string,
): Promise<Membership | null> {
  const supabase = await createClient();
  let query = supabase
    .from("restaurant_members")
    .select("restaurant_id, role, restaurants (name, slug, timezone, currency)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load membership: ${error.message}`);
  if (!data || !data.restaurants) return null;
  return {
    restaurantId: data.restaurant_id,
    restaurantName: data.restaurants.name,
    restaurantSlug: data.restaurants.slug,
    restaurantTimezone: data.restaurants.timezone,
    restaurantCurrency: data.restaurants.currency,
    role: data.role,
  };
}

/** Staff with a restaurant. Staff without one are sent to onboarding. */
export async function requireMembership(
  restaurantId?: string,
): Promise<StaffUser & { membership: Membership }> {
  const user = await requireStaff();
  const membership = await getMembership(user.userId, restaurantId);
  if (!membership) redirect("/restaurant/onboarding");
  return { ...user, membership };
}
