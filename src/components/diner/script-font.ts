import { Dancing_Script } from "next/font/google";

/**
 * The script for the diner menu's section titles: Dancing Script Medium (ruled 2026-10-04,
 * replacing Ms Madi from "4a"). Loaded only by the menu, so no other page fetches it.
 */
export const scriptFont = Dancing_Script({
  weight: "500",
  variable: "--font-dancing-script",
  subsets: ["latin"],
});
