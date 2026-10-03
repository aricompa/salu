import { z } from "zod";
import { uuidField } from "./fields";

/** Largest price the database accepts (menu_items.price_cents check). */
export const MAX_PRICE_CENTS = 1_000_000;

const PRICE_PATTERN = /^(?:\d{1,5}(?:\.\d{1,2})?|\.\d{1,2})$/;

/**
 * "12.50" -> 1250 using integer arithmetic only (CLAUDE.md rule A6: never floats).
 * Accepts an optional leading "$". Returns null for anything else.
 */
export function parsePriceToCents(input: string): number | null {
  const text = input.trim().replace(/^\$/, "");
  if (!PRICE_PATTERN.test(text)) return null;
  const [whole = "", fraction = ""] = text.split(".");
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"));
  return cents <= MAX_PRICE_CENTS ? cents : null;
}

/** 1250 -> "12.50", for pre-filling the price field. Not for display (use formatCents). */
export function centsToPriceInput(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error("money must be non-negative cents");
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export { DIETARY_TAGS, dietaryShort, type DietaryTag } from "@/lib/dietary";
import { DIETARY_TAGS, type DietaryTag } from "@/lib/dietary";

const TAG_VALUES = DIETARY_TAGS.map((t) => t.value) as [DietaryTag, ...DietaryTag[]];

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Give the category a name.")
  .max(60, "Use 60 characters or fewer.");

export const categorySchema = z.object({ name: categoryNameSchema });

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Give the item a name.").max(120, "Use 120 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(500, "Use 500 characters or fewer.")
    .transform((v) => (v === "" ? null : v)),
  price: z.string().transform((v, ctx) => {
    const cents = parsePriceToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Enter a price like 12.50, up to 10,000.00." });
      return z.NEVER;
    }
    return cents;
  }),
  categoryId: z.union([z.literal("").transform(() => null), uuidField]),
  dietaryTags: z
    .array(z.enum(TAG_VALUES, "Pick tags from the list."))
    .transform((tags) => [...new Set(tags)]),
  isAvailable: z.boolean(),
  // linked add-ons (ruled 2026-10-03): only sold inside the items it goes with
  addonOnly: z.boolean(),
  goesWith: z
    .array(uuidField, "Pick items from the list.")
    .max(500, "Pick items from the list.")
    .transform((ids) => [...new Set(ids)]),
});

export type ItemInput = z.output<typeof itemSchema>;

/** Reads the item form's fields out of FormData (checkboxes arrive as "on" or missing). */
export function itemFormValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    price: String(formData.get("price") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    dietaryTags: formData.getAll("dietaryTags").map(String),
    isAvailable: formData.get("isAvailable") === "on",
    addonOnly: formData.get("addonOnly") === "on",
    goesWith: formData.getAll("goesWith").map(String),
  };
}

export const moveSchema = z.object({
  id: uuidField,
  direction: z.enum(["up", "down"]),
});
