import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isEmailOtpType, verifyEmailToken } from "@/lib/staff-auth";
import { safeNextPath } from "@/lib/validation/auth";

/**
 * Email links (token_hash flow). A confirmation goes on to `next` (same-origin only); a
 * password-reset link always lands on the new-password page, whatever `next` says.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next =
    type === "recovery"
      ? "/login/new-password"
      : safeNextPath(searchParams.get("next"), "/restaurant/onboarding");

  if (tokenHash && isEmailOtpType(type) && (await verifyEmailToken(tokenHash, type))) {
    redirect(next);
  }
  redirect(type === "recovery" ? "/login?error=reset" : "/login?error=confirm");
}
