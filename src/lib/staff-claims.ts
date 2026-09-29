/**
 * The one rule for "is this a staff session": a signed-in user whose JWT says
 * is_anonymous = false. A missing claim fails closed (matches private.is_anonymous()).
 */
export function isStaffClaims(
  claims: { sub?: unknown; is_anonymous?: unknown } | null | undefined,
): claims is { sub: string; is_anonymous: false } {
  return typeof claims?.sub === "string" && claims.sub.length > 0 && claims.is_anonymous === false;
}
