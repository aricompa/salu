import { z } from "zod";
import { intField } from "./fields";

/** True for any IANA zone this runtime can format in (covers aliases like "UTC"). */
export function isValidTimeZone(tz: string): boolean {
  if (tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const restaurantProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your restaurant's name.")
    .max(120, "Use 120 characters or fewer."),
  timezone: z.string().trim().refine(isValidTimeZone, "Pick a time zone from the list."),
});

export const orderSettingsSchema = z.object({
  editWindowMins: intField(0, 30, "Use a whole number of minutes from 0 to 30."),
  additionCutoffMins: intField(0, 240, "Use a whole number of minutes from 0 to 240."),
});

export type RestaurantProfileInput = z.output<typeof restaurantProfileSchema>;
export type OrderSettingsInput = z.output<typeof orderSettingsSchema>;
