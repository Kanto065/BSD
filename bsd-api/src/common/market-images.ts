import sharp from "sharp";
import { ImageRejected, MAX_INPUT_PIXELS, sniffImageType } from "./images.js";

// Marketplace photos. Unlike directory photos these are always re-encoded: resized to at most 1600 px, stamped with a
// small "bsd.wales" mark in the bottom right corner, saved as WebP under 300 KB, with all metadata (EXIF, GPS) dropped.
// sharp removes metadata unless withMetadata() is called, and rotate() applies the camera orientation first.

export const MARKET_MAX_SIDE = 1600;
export const MARKET_MAX_BYTES = 300 * 1024;
export const MARKET_THUMB_SIDE = 480;
export const MARKET_MAX_IMAGES = 5;

export type MarketImageResult = { master: Buffer; thumb: Buffer; width: number; height: number };

const open = (buf: Buffer) => sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });

function watermark(width: number, height: number): Buffer {
  const size = Math.max(14, Math.round(Math.min(width, height) * 0.045));
  const w = Math.round(size * 6.4);
  const h = Math.round(size * 1.6);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<text x="${w - 4}" y="${Math.round(size * 1.2)}" font-family="sans-serif" font-size="${size}" font-weight="bold" text-anchor="end" fill="#ffffff" fill-opacity="0.85" stroke="#000000" stroke-opacity="0.45" stroke-width="${Math.max(1, size / 14)}" paint-order="stroke">bsd.wales</text></svg>`
  );
}

export async function processMarketImage(input: Buffer): Promise<MarketImageResult> {
  if (!sniffImageType(input)) throw new ImageRejected("unsupported_type", "Only JPEG, PNG and WebP images are accepted");
  try {
    const meta = await open(input).metadata();
    if ((meta.pages ?? 1) > 1) throw new ImageRejected("animated", "Animated images are not accepted");
    if (!meta.width || !meta.height) throw new ImageRejected("corrupt", "The image could not be read");
    if (meta.width < 16 || meta.height < 16) throw new ImageRejected("too_small", "The image is too small");

    let side = MARKET_MAX_SIDE;
    for (let attempt = 0; attempt < 4; attempt++, side = Math.round(side * 0.8)) {
      const { data: base, info } = await open(input)
        .rotate()
        .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
        .toBuffer({ resolveWithObject: true });
      const mark = watermark(info.width, info.height);
      for (const quality of [80, 65, 50, 38]) {
        const master = await sharp(base).composite([{ input: mark, gravity: "southeast" }]).webp({ quality, effort: 4 }).toBuffer();
        if (master.length <= MARKET_MAX_BYTES) {
          const thumb = await sharp(master).resize({ width: MARKET_THUMB_SIDE, height: MARKET_THUMB_SIDE, fit: "inside", withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
          return { master, thumb, width: info.width, height: info.height };
        }
      }
    }
    throw new ImageRejected("corrupt", "The image could not be made small enough");
  } catch (err) {
    if (err instanceof ImageRejected) throw err;
    if (/pixel limit/i.test(String((err as Error).message))) throw new ImageRejected("too_many_pixels", "The image has too many pixels");
    throw new ImageRejected("corrupt", "The image could not be read");
  }
}
