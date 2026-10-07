import { describe, it, expect, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000 });
import sharp from "sharp";
import { processMarketImage, MARKET_MAX_BYTES } from "../src/common/market-images.js";
import { ImageRejected } from "../src/common/images.js";
import { noisyJpeg } from "./helpers/market.js";

describe("market image pipeline", () => {
  it("shrinks a big noisy photo to WebP under 300 KB, at most 1600 px, with a thumbnail", async () => {
    const out = await processMarketImage(await noisyJpeg());
    expect(out.master.length).toBeLessThanOrEqual(MARKET_MAX_BYTES);
    const meta = await sharp(out.master).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1600);
    expect(meta.exif).toBeUndefined();
    expect((await sharp(out.thumb).metadata()).width).toBeLessThanOrEqual(480);
  });

  it("stamps the watermark into the bottom right corner (pixels differ from an unmarked copy)", async () => {
    const plain = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#808080" } }).png().toBuffer();
    const out = await processMarketImage(plain);
    const { data, info } = await sharp(out.master).raw().toBuffer({ resolveWithObject: true });
    let marked = 0;
    for (let y = info.height - 60; y < info.height; y++) for (let x = info.width - 200; x < info.width; x++) {
      const v = data[(y * info.width + x) * info.channels]!;
      if (Math.abs(v - 128) > 25) marked++;
    }
    // Needs a system font. If this is 0 on a machine without fonts, the live check in the tester steps covers it.
    expect(marked).toBeGreaterThan(20);
  });

  it("rejects non images by their bytes, and animated images", async () => {
    await expect(processMarketImage(Buffer.from("%PDF-1.4 not an image at all"))).rejects.toBeInstanceOf(ImageRejected);
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    await expect(processMarketImage(gif)).rejects.toBeInstanceOf(ImageRejected);
  });
});
