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

/** Fixed vocabulary for dietary tags. `short` is the chip text diners see. */
export const DIETARY_TAGS = [
  { value: "vegetarian", short: "V", label: "Vegetarian" },
  { value: "vegan", short: "VG", label: "Vegan" },
  { value: "gluten-free", short: "GF", label: "Gluten-free" },
  { value: "dairy-free", short: "DF", label: "Dairy-free" },
  { value: "contains-nuts", short: "Nuts", label: "Contains nuts" },
  { value: "spicy", short: "Spicy", label: "Spicy" },
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number]["value"];

const TAG_VALUES = DIETARY_TAGS.map((t) => t.value) as [DietaryTag, ...DietaryTag[]];

/** Short chip text for a stored tag; unknown tags are shown as stored. */
export function dietaryShort(tag: string): string {
  return DIETARY_TAGS.find((t) => t.value === tag)?.short ?? tag;
}

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
  dietaryTags: z.array(z.enum(TAG_VALUES, "Pick tags from the list.")),
  isAvailable: z.boolean(),
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
  };
}

export const moveSchema = z.object({
  id: uuidField,
  direction: z.enum(["up", "down"]),
});
