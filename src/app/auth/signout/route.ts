import { NextResponse, type NextRequest } from "next/server";
import { signOutStaff } from "@/lib/staff-auth";

// POST only, so a link or prefetch can't sign someone out.
export async function POST(request: NextRequest) {
  await signOutStaff();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
