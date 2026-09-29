import { describe, expect, it } from "vitest";
import { restaurantSchema, slugify, SLUG_PATTERN } from "./restaurant";

describe("slugify", () => {
  it.each([
    ["Casa Grande", "casa-grande"],
    ["Café Olé & Co.", "cafe-ole-co"],
    ["  --Joe's   Diner--  ", "joe-s-diner"],
    ["", ""],
  ])("%s -> %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("always produces a slug the database accepts (or empty)", () => {
    for (const name of ["A", "Déjà Vu Bistro", "123 Main St.", "x".repeat(200)]) {
      const slug = slugify(name);
      if (slug.length >= 2) expect(slug).toMatch(SLUG_PATTERN);
      expect(slug.length).toBeLessThanOrEqual(60);
    }
  });
});

describe("restaurantSchema", () => {
  it("accepts a valid name and slug", () => {
    expect(restaurantSchema.parse({ name: " Casa Grande ", slug: "Casa-Grande" })).toEqual({
      name: "Casa Grande",
      slug: "casa-grande",
    });
  });

  it.each(["a", "casa--grande", "-casa", "casa grande", "casa_grande"])(
    "rejects slug %s",
    (slug) => {
      expect(restaurantSchema.safeParse({ name: "Casa", slug }).success).toBe(false);
    },
  );
});
