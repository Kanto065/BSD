import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import { ImageRejected, THUMB_MAX_SIDE, processImage, sniffImageType, stripJpegMetadata, stripWebpMetadata } from "../src/common/images.js";

vi.setConfig({ testTimeout: 60_000 }); // large lossless encodes are slow by design

// The promise behind these tests: stored images are smaller, never worse, and carry no hidden metadata.

/** A photo-like image: smooth gradients plus noise, so it neither compresses to nothing nor is pure static. */
function photoPixels(w: number, h: number, channels: 3 | 4 = 3): Buffer {
  const buf = Buffer.alloc(w * h * channels);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16) & 0xff;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * channels;
      buf[o] = (x * 255) / w + (rnd() % 24);
      buf[o + 1] = (y * 255) / h + (rnd() % 24);
      buf[o + 2] = ((x + y) * 255) / (w + h) + (rnd() % 24);
      if (channels === 4) buf[o + 3] = 255;
    }
  }
  return buf;
}
const raw = (w: number, h: number, channels: 3 | 4 = 3) => sharp(photoPixels(w, h, channels), { raw: { width: w, height: h, channels } });
const decode = (b: Buffer) => sharp(b).ensureAlpha().raw().toBuffer();

const SECRETS = ["secret-owner-name", "SECRET-TRAILER-VIDEO", "51/1 38/1 12/1"];
const containsSecret = (b: Buffer) => SECRETS.some((s) => b.includes(Buffer.from(s)));

async function jpegWithMetadata(w = 1200, h = 900, orientation?: number): Promise<Buffer> {
  const base = await raw(w, h)
    .jpeg({ quality: 92 })
    .withExif({ IFD0: { Copyright: "secret-owner-name" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 38/1 12/1" } })
    .withMetadata(orientation ? { orientation } : {})
    .toBuffer();
  return Buffer.concat([base, Buffer.from("SECRET-TRAILER-VIDEO")]); // like the video in a motion photo
}

describe("sniffImageType", () => {
  it("reads the real type from the bytes", async () => {
    expect(sniffImageType(await raw(32, 32).jpeg().toBuffer())).toBe("jpeg");
    expect(sniffImageType(await raw(32, 32).png().toBuffer())).toBe("png");
    expect(sniffImageType(await raw(32, 32).webp().toBuffer())).toBe("webp");
    expect(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffImageType(Buffer.from("GIF89a....."))).toBeNull();
    expect(sniffImageType(Buffer.from("hello world, definitely not an image"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("JPEG: picture data kept byte for byte, metadata removed", () => {
  it("decodes to exactly the same pixels, is not larger, and has no metadata or trailing data", async () => {
    const original = await jpegWithMetadata();
    expect(containsSecret(original)).toBe(true); // the fixture really does carry the secrets
    const out = await processImage(original);

    expect(out.stats.method).toBe("jpeg-lossless-strip");
    expect(out.master.contentType).toBe("image/jpeg");
    expect(out.master.buffer.length).toBeLessThan(original.length);
    expect(containsSecret(out.master.buffer)).toBe(false);
    expect((await sharp(out.master.buffer).metadata()).exif).toBeUndefined();
    // the important one: not one pixel differs
    expect((await decode(out.master.buffer)).equals(await decode(original))).toBe(true);
    expect(out.master.width).toBe(1200);
    expect(out.master.height).toBe(900);
  });

  it("keeps the ICC colour profile", async () => {
    const withIcc = await raw(400, 300).jpeg({ quality: 90 }).withIccProfile("p3").toBuffer();
    expect((await sharp(withIcc).metadata()).icc).toBeDefined();
    const out = await processImage(withIcc);
    expect(out.stats.method).toBe("jpeg-lossless-strip");
    expect((await sharp(out.master.buffer).metadata()).icc).toBeDefined();
    expect((await decode(out.master.buffer)).equals(await decode(withIcc))).toBe(true);
  });

  it("stripJpegMetadata output is a valid JPEG that still ends with the end-of-image marker", async () => {
    const out = stripJpegMetadata(await jpegWithMetadata(200, 150));
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(out[out.length - 2]).toBe(0xff);
    expect(out[out.length - 1]).toBe(0xd9);
  });

  it("re-encodes once, at quality 95, only when the orientation flag needs applying", async () => {
    const original = await jpegWithMetadata(1200, 900, 6); // rotated 90 degrees by the camera flag
    const out = await processImage(original);
    expect(out.stats.method).toBe("jpeg-rotated-q95");
    expect(out.master.width).toBe(900); // width and height swapped
    expect(out.master.height).toBe(1200);
    expect((await sharp(out.master.buffer).metadata()).orientation).toBeUndefined();
    expect(containsSecret(out.master.buffer)).toBe(false);
    // and it looks like the rotated original
    const reference = await sharp(original).rotate().ensureAlpha().raw().toBuffer();
    const got = await decode(out.master.buffer);
    // mean absolute error over the whole image, on deliberately noisy data (a single-pixel maximum is not meaningful)
    let total = 0;
    for (let i = 0; i < reference.length; i++) total += Math.abs(reference[i] - got[i]);
    expect(total / reference.length).toBeLessThan(3);
  });

  it("converts CMYK to sRGB, which browsers display correctly", async () => {
    const cmyk = await raw(300, 200).toColourspace("cmyk").jpeg({ quality: 90 }).toBuffer();
    if ((await sharp(cmyk).metadata()).space !== "cmyk") return; // this sharp build cannot write CMYK
    const out = await processImage(cmyk);
    expect(out.stats.method).toBe("jpeg-cmyk-to-srgb-q95");
    expect((await sharp(out.master.buffer).metadata()).space).toBe("srgb");
  });
});

describe("PNG: lossless, never larger", () => {
  it("large photo-like PNGs stay PNG (fast) and keep every pixel", async () => {
    const original = await raw(1600, 1000, 4).png({ compressionLevel: 1 }).toBuffer();
    const started = Date.now();
    const out = await processImage(original);
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(out.stats.method).toBe("png-lossless");
    expect((await decode(out.master.buffer)).equals(await decode(original))).toBe(true);
  });

  it("keeps every pixel, including transparency, for a photo-like PNG", async () => {
    const original = await raw(800, 600, 4).png({ compressionLevel: 1 }).toBuffer(); // deliberately poorly compressed
    const out = await processImage(original);
    expect(out.master.buffer.length).toBeLessThan(original.length);
    expect((await decode(out.master.buffer)).equals(await decode(original))).toBe(true);
    expect(["png-lossless", "png-to-lossless-webp"]).toContain(out.stats.method);
  });

  it("uses lossless WebP for a flat logo when that is smaller, with identical pixels", async () => {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300"><rect width="500" height="300" fill="#0C2E42"/><circle cx="250" cy="150" r="90" fill="#219E89"/><rect x="60" y="40" width="380" height="30" fill="#C42B26"/></svg>`
    );
    const original = await sharp(svg).png({ compressionLevel: 0 }).toBuffer();
    const out = await processImage(original);
    expect(out.master.buffer.length).toBeLessThan(original.length / 4);
    expect((await decode(out.master.buffer)).equals(await decode(original))).toBe(true);
  });

  it("keeps the original bytes if nothing beats them", async () => {
    const already = await sharp(photoPixels(200, 150, 3), { raw: { width: 200, height: 150, channels: 3 } })
      .png({ compressionLevel: 9, effort: 10 })
      .toBuffer();
    const out = await processImage(already);
    expect(out.master.buffer.length).toBeLessThanOrEqual(already.length);
    expect((await decode(out.master.buffer)).equals(await decode(already))).toBe(true);
  });
});

describe("WebP: picture data untouched, metadata removed", () => {
  it("removes EXIF and keeps the pixels identical", async () => {
    const original = await raw(600, 400)
      .webp({ quality: 88 })
      .withExif({ IFD0: { Copyright: "secret-owner-name" } })
      .toBuffer();
    expect(containsSecret(original)).toBe(true);
    const out = await processImage(original);
    expect(out.stats.method).toBe("webp-lossless-strip");
    expect(containsSecret(out.master.buffer)).toBe(false);
    expect(out.master.buffer.length).toBeLessThan(original.length);
    expect((await decode(out.master.buffer)).equals(await decode(original))).toBe(true);
    expect(sniffImageType(stripWebpMetadata(original))).toBe("webp");
  });
});

describe("thumbnails", () => {
  it("makes a WebP thumbnail no larger than 720px on the longest side, and keeps the master full size", async () => {
    const out = await processImage(await raw(2000, 1500).jpeg({ quality: 90 }).toBuffer());
    expect(out.master.width).toBe(2000);
    expect(out.thumb).not.toBeNull();
    expect(out.thumb!.contentType).toBe("image/webp");
    expect(Math.max(out.thumb!.width, out.thumb!.height)).toBe(THUMB_MAX_SIDE);
    expect(out.thumb!.width / out.thumb!.height).toBeCloseTo(2000 / 1500, 1);
    expect(out.thumb!.buffer.length).toBeLessThan(out.master.buffer.length / 3);
    const meta = await sharp(out.thumb!.buffer).metadata();
    expect(meta.width).toBe(out.thumb!.width);
  });

  it("does not make one for an image that is already small", async () => {
    const out = await processImage(await raw(600, 400).jpeg({ quality: 90 }).toBuffer());
    expect(out.thumb).toBeNull();
  });

  it("keeps transparency in the thumbnail of a large PNG", async () => {
    const pixels = photoPixels(1600, 1000, 4);
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = (i >> 2) % 1600 < 800 ? 0 : 255; // left half see-through
    const out = await processImage(await sharp(pixels, { raw: { width: 1600, height: 1000, channels: 4 } }).png().toBuffer());
    expect(out.thumb).not.toBeNull();
    expect((await sharp(out.thumb!.buffer).metadata()).hasAlpha).toBe(true);
  });
});

describe("rejects what it should", () => {
  const reject = async (buf: Buffer, code: string) => {
    const err = await processImage(buf).then(
      () => null,
      (e) => e
    );
    expect(err, code).toBeInstanceOf(ImageRejected);
    expect((err as ImageRejected).code).toBe(code);
  };

  it("rejects files that are not JPEG, PNG or WebP, whatever they are called", async () => {
    await reject(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'></svg>"), "unsupported_type");
    await reject(Buffer.from("GIF89a\x01\x00\x01\x00"), "unsupported_type");
    await reject(Buffer.from("<?php system($_GET['c']); ?>"), "unsupported_type");
    await reject(Buffer.from("%PDF-1.4 fake"), "unsupported_type");
  });

  it("rejects a JPEG or PNG that is damaged or cut short", async () => {
    const jpeg = await raw(400, 300).jpeg().toBuffer();
    await reject(jpeg.subarray(0, Math.floor(jpeg.length / 2)), "corrupt");
    await reject(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("garbage garbage garbage")]), "corrupt");
    const png = await raw(400, 300).png().toBuffer();
    await reject(png.subarray(0, 60), "corrupt");
  });

  it("rejects an image with too many pixels (a decompression bomb) without decoding it", async () => {
    const bomb = await sharp({ create: { width: 9000, height: 9000, channels: 3, background: "#123456" } }).png().toBuffer();
    expect(bomb.length).toBeLessThan(5_000_000); // small on disk, 81 million pixels in memory
    await reject(bomb, "too_many_pixels");
  });

  it("rejects an animated WebP", async () => {
    const frames = Buffer.concat([photoPixels(64, 64), photoPixels(64, 64).reverse()]);
    const animated = await sharp(frames, { raw: { width: 64, height: 128, channels: 3, pageHeight: 64 } as never })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    if (((await sharp(animated).metadata()).pages ?? 1) < 2) return; // this sharp build could not write one
    await reject(animated, "animated");
  });

  it("rejects an image that is too small to be a real photo or logo", async () => {
    await reject(await raw(8, 8).png().toBuffer(), "too_small");
  });
});
