import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the claims in the globals.css header: every text token meets WCAG AA
 * (4.5:1) on both surfaces, border and focus meet 3:1, button text meets 4.5:1 on
 * brand and brand-hover, and brand as a selected-state fill meets 3:1 on surface,
 * in both themes. Brand (Persimmon) is too light to be text on a light surface, so
 * no component may use it as text. Also keeps the app icon (an image route that
 * can't read CSS tokens, exception (bh)) on the light brand colour, and checks the
 * colour layer (the same in both themes): header text on the Marigold band and
 * charcoal on every accent and tint.
 */
const css = readFileSync("src/app/globals.css", "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--salu-([a-z0-9-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]),
  );
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = {
  light: block(':root,\n[data-theme="light"] {'),
  dark: block('[data-theme="dark"] {'),
};

describe("theme tokens", () => {
  it("the device-dark block repeats the forced-dark block exactly", () => {
    expect(block(':root:not([data-theme="light"]) {')).toEqual(themes.dark);
  });

  for (const [name, t] of Object.entries(themes)) {
    describe(name, () => {
      for (const surface of ["surface", "surface-raised"]) {
        for (const token of ["text", "text-muted", "success", "warning", "danger"]) {
          it(`${token} on ${surface} is at least 4.5:1`, () => {
            expect(contrast(t[token], t[surface])).toBeGreaterThanOrEqual(4.5);
          });
        }
        for (const token of ["border", "focus"]) {
          it(`${token} on ${surface} is at least 3:1`, () => {
            expect(contrast(t[token], t[surface])).toBeGreaterThanOrEqual(3);
          });
        }
      }
      it("brand as a selected-state fill is at least 3:1 on surface", () => {
        expect(contrast(t.brand, t.surface)).toBeGreaterThanOrEqual(3);
      });
      for (const fill of ["brand", "brand-hover"]) {
        it(`button text on ${fill} is at least 4.5:1`, () => {
          expect(contrast(t["brand-contrast"], t[fill])).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }

  describe("colour layer", () => {
    const layer = block(":root {");
    it("is defined", () => {
      expect(Object.keys(layer)).toContain("header");
    });
    for (const token of ["header-text", "header-muted"]) {
      it(`${token} on the header band is at least 4.5:1`, () => {
        expect(contrast(layer[token], layer.header)).toBeGreaterThanOrEqual(4.5);
      });
    }
    for (const n of [1, 2, 3, 4]) {
      for (const fill of [`accent-${n}`, `accent-${n}-soft`]) {
        it(`on-accent text on ${fill} is at least 4.5:1`, () => {
          expect(contrast(layer["on-accent"], layer[fill])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  });

  it("no component uses brand as a text colour", () => {
    const offenders = readdirSync("src", { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
      .filter((f) => /\btext-brand(?![-\w])/.test(readFileSync(`src/${f}`, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the app icon background is the light brand colour", () => {
    const icon = readFileSync("src/lib/app-icon.tsx", "utf8");
    const [, r, g, b] = icon.match(/ICON_BACKGROUND = "rgb\((\d+), (\d+), (\d+)\)"/) ?? [];
    const hex = `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
    expect(hex).toBe(themes.light.brand);
  });
});
