import { appIcon } from "@/lib/app-icon";

/** Home-screen icon for iOS (iPhone Safari is the Phase 1 exit device). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180);
}
