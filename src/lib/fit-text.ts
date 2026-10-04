/**
 * The largest font size from `start` down to `min` (whole pixels) at which `fits` says the
 * text fits on one line, or null when it doesn't fit even at `min` (the caller wraps it
 * then, rather than cutting it off). Keeps the diner menu's section titles on one line
 * (2026-10-04): a long name shrinks just enough, a short one keeps its size.
 */
export function fitFontSize(
  start: number,
  min: number,
  fits: (size: number) => boolean,
): number | null {
  for (let size = Math.floor(start); size >= min; size -= 1) {
    if (fits(size)) return size;
  }
  return null;
}
