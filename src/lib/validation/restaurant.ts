import { z } from "zod";

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const restaurantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your restaurant's name.")
    .max(120, "Use 120 characters or fewer."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Use at least 2 characters.")
    .max(60, "Use 60 characters or fewer.")
    .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single dashes, like casa-grande."),
});

/** "Café Olé & Co." -> "cafe-ole-co" */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
