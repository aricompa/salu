import { appIcon } from "@/lib/app-icon";

/** PWA icons at the two sizes install prompts ask for, served at /icon/192 and /icon/512. */
const SIZES = [192, 512] as const;

export function generateImageMetadata() {
  return SIZES.map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const px = Number(await id);
  return appIcon(SIZES.includes(px as (typeof SIZES)[number]) ? px : 192);
}
