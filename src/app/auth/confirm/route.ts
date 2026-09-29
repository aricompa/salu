import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isEmailOtpType, verifyEmailToken } from "@/lib/staff-auth";
import { safeNextPath } from "@/lib/validation/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"), "/restaurant/onboarding");

  if (tokenHash && isEmailOtpType(type) && (await verifyEmailToken(tokenHash, type))) {
    redirect(next);
  }
  redirect("/login?error=confirm");
}
