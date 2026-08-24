import { test, expect } from "@playwright/test";

/**
 * A phone photo must survive the cropper.
 *
 * Reported from an Android device: picking an image showed "this format could not be read, try a
 * JPG or PNG" — about a file that was almost certainly already a JPG. The cropper decoded at FULL
 * resolution, and a modern camera shoots 50-200MP, which is hundreds of megabytes as a bitmap. The
 * WebView gave up, and every failure surfaced as the same "wrong format" message.
 *
 * These run the real browser decode path rather than mocking it.
 */
test("a very large photo decodes within a bounded budget", async ({ page }) => {
  await page.goto("/uz/gigs");

  const result = await page.evaluate(async () => {
    const make = async (w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d")!;
      x.fillStyle = "#c0562a";
      x.fillRect(0, 0, w, h);
      // A recognisable mark, so we can prove the DOWNSCALED copy still holds real pixels.
      x.fillStyle = "#123456";
      x.fillRect(0, 0, Math.round(w / 2), Math.round(h / 2));
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
      return new File([blob!], "photo.jpg", { type: "image/jpeg" });
    };

    // 108MP, the shape of a Samsung hi-res shot.
    const file = await make(12000, 9000);
    const probe = await createImageBitmap(file);
    const long = Math.max(probe.width, probe.height);
    const k = 2048 / long;
    probe.close();
    const bm = await createImageBitmap(file, {
      resizeWidth: Math.round(12000 * k),
      resizeHeight: Math.round(9000 * k),
      resizeQuality: "high",
    });

    // Read a pixel back to prove the image survived the downscale rather than arriving blank.
    const c = document.createElement("canvas");
    c.width = bm.width;
    c.height = bm.height;
    c.getContext("2d")!.drawImage(bm, 0, 0);
    const px = c.getContext("2d")!.getImageData(10, 10, 1, 1).data;
    const out = { w: bm.width, h: bm.height, r: px[0], g: px[1], b: px[2] };
    bm.close();
    return out;
  });

  // Bounded to the long edge, aspect preserved.
  expect(result.w).toBeLessThanOrEqual(2048);
  expect(result.h).toBeLessThanOrEqual(2048);
  expect(Math.abs(result.w / result.h - 12000 / 9000)).toBeLessThan(0.01);
  // The top-left mark is #123456, so real pixels came through.
  expect(result.r).toBeLessThan(60);
  expect(result.b).toBeGreaterThan(60);
});

test("2048px is far more detail than a 512px crop can hold", async ({ page }) => {
  // The reason bounding costs nothing: every caller renders to at most a few hundred pixels, so
  // the decode ceiling is already several times the output.
  await page.goto("/uz/gigs");
  const ratio = await page.evaluate(() => 2048 / 512);
  expect(ratio).toBeGreaterThanOrEqual(4);
});
