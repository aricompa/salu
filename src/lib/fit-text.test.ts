import { describe, expect, it } from "vitest";
import { fitFontSize } from "./fit-text";

// A title whose width grows with its font size, in a 358px column (a 390px phone).
const fitsIn = (column: number, widthPerPx: number) => (size: number) =>
  size * widthPerPx <= column;

describe("fitFontSize", () => {
  it("keeps the starting size when the title already fits", () => {
    expect(fitFontSize(42, 26, fitsIn(358, 4))).toBe(42);
  });

  it("shrinks a long title just enough to fit on one line", () => {
    // 8.7px of width per px of font: 41px is 356.7px wide, 42px would be 365.4px
    expect(fitFontSize(42, 26, fitsIn(358, 8.7))).toBe(41);
  });

  it("fits at exactly the minimum", () => {
    expect(fitFontSize(42, 26, fitsIn(260, 10))).toBe(26);
  });

  it("answers null when even the minimum doesn't fit, so the title wraps instead", () => {
    expect(fitFontSize(42, 26, fitsIn(100, 20))).toBeNull();
  });
});
