import { Ms_Madi } from "next/font/google";

/**
 * The signature script for the diner menu's section titles ("4a", 2026-10-03), echoing the
 * brand guide's handwritten page titles. Loaded only by the menu, so no other page fetches it.
 */
export const scriptFont = Ms_Madi({
  weight: "400",
  variable: "--font-ms-madi",
  subsets: ["latin"],
});
