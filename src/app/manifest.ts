import type { MetadataRoute } from "next";
import { ICON_BACKGROUND } from "@/lib/app-icon";

/**
 * Web app manifest (PWA). One manifest for the whole site: staff add the portal to a
 * tablet's home screen; diners never need to install anything (rule 2, no app download).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Salu",
    short_name: "Salu",
    description: "Scan, order and pay from your table.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "rgb(255, 255, 255)",
    theme_color: ICON_BACKGROUND,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
