import { expect, test } from "@playwright/test";

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("the web app manifest serves, and every icon it names is a PNG of that size", async ({
  request,
}) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/manifest+json");
  const manifest = (await res.json()) as {
    name: string;
    display: string;
    start_url: string;
    icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  };
  expect(manifest).toMatchObject({ name: "Salu", display: "standalone", start_url: "/" });
  expect(manifest.icons.map((i) => i.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
  expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);

  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.status(), icon.src).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
    const [w, h] = icon.sizes.split("x").map(Number);
    expect(pngSize(await image.body())).toEqual({ width: w, height: h });
  }
});

test("pages link the manifest and an iOS home-screen icon", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(apple).toBeTruthy();
  const image = await request.get(apple as string);
  expect(image.status()).toBe(200);
  expect(pngSize(await image.body())).toEqual({ width: 180, height: 180 });
});
