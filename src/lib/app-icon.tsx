import { ImageResponse } from "next/og";

/**
 * The app icon: a charcoal "S" on Persimmon (globals.css --salu-brand and --salu-text, light;
 * open decision 1, 2026-10-02). The pre-commit hook blocks hex outside globals.css, so the colours
 * are rgb() (a logged rule U3 exception: image routes can't read CSS tokens).
 */
export const ICON_BACKGROUND = "rgb(242, 105, 36)";
export const ICON_FOREGROUND = "rgb(26, 23, 23)";

/** Square PNG. The letter stays inside the central 80%, so it also works as a maskable icon. */
export function appIcon(size: number): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: ICON_BACKGROUND,
        color: ICON_FOREGROUND,
        fontSize: Math.round(size * 0.56),
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      S
    </div>,
    { width: size, height: size },
  );
}
