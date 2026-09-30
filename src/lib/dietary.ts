/**
 * The fixed dietary tag vocabulary (builder call (d), DB check since open decision 8).
 * Kept free of zod so diner pages can show chips without shipping the validator.
 */
export const DIETARY_TAGS = [
  { value: "vegetarian", short: "V", label: "Vegetarian" },
  { value: "vegan", short: "VG", label: "Vegan" },
  { value: "gluten-free", short: "GF", label: "Gluten-free" },
  { value: "dairy-free", short: "DF", label: "Dairy-free" },
  { value: "contains-nuts", short: "Nuts", label: "Contains nuts" },
  { value: "spicy", short: "Spicy", label: "Spicy" },
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number]["value"];

/** Short chip text for a stored tag; unknown tags are shown as stored. */
export function dietaryShort(tag: string): string {
  return DIETARY_TAGS.find((t) => t.value === tag)?.short ?? tag;
}
