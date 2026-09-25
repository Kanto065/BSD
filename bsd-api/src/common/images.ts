import sharp, { type Metadata } from "sharp";

// Image handling for business photos and logos.
//
// The rule is "smaller files, never worse pictures". The full-size image is never resized and its picture data is
// never re-encoded lossily when it can be avoided:
//   JPEG  the compressed picture data is kept byte for byte. Only metadata is removed (EXIF with GPS location and
//         camera details, XMP, embedded previews, comments, and anything appended after the image such as the video
//         in a "motion photo"). The colour profile is kept.
//   PNG   re-encoded losslessly at maximum compression, and also as lossless WebP. The smallest result wins, and the
//         original is kept if neither is smaller. Pixels are identical either way.
//   WebP  picture data untouched, metadata chunks removed.
// Two cases have to be re-encoded, and are reported in `method`: a JPEG whose orientation is set by a camera flag
// (rotated once at quality 95, 4:4:4) and CMYK JPEGs (converted to sRGB, which browsers display correctly).
//
// A separate thumbnail (WebP, quality 90, longest side 720px) is made for cards and grids when the image is larger,
// so a page never has to load several multi-megabyte originals.

export type ImageKind = "jpeg" | "png" | "webp";

export class ImageRejected extends Error {
  constructor(
    public readonly code: "unsupported_type" | "corrupt" | "animated" | "too_many_pixels" | "too_small",
    message: string
  ) {
    super(message);
  }
}

export const MAX_INPUT_PIXELS = 80_000_000;
export const THUMB_MAX_SIDE = 720;
// Lossless WebP wins big on logos and flat graphics but costs seconds per megapixel on photos, for little gain.
// Above this size only optimised PNG is tried, which is fast. Both are lossless.
export const LOSSLESS_WEBP_MAX_PIXELS = 1_500_000;
const THUMB_QUALITY = 90;

export type StoredFile = { buffer: Buffer; contentType: string; ext: "jpg" | "png" | "webp" };

export type ProcessedImage = {
  master: StoredFile & { width: number; height: number };
  /** Null when the image is already small enough to use as its own thumbnail. */
  thumb: (StoredFile & { width: number; height: number }) | null;
  stats: { originalBytes: number; storedBytes: number; thumbBytes: number; method: string };
};

/** What the bytes really are, from their signature. The mimetype a browser sends is not trusted. */
export function sniffImageType(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

// ---------------------------------------------------------------------------
// JPEG: lossless metadata removal
// ---------------------------------------------------------------------------

const ICC_ID = Buffer.from("ICC_PROFILE\0", "latin1");

/**
 * Removes metadata from a JPEG without touching the compressed picture data.
 * Kept: JFIF (APP0), the ICC colour profile (APP2 "ICC_PROFILE") and Adobe colour info (APP14).
 * Dropped: EXIF and XMP (APP1), all other APPn (including multi-picture APP2 "MPF"), comments, and every byte after
 * the end-of-image marker.
 */
export function stripJpegMetadata(buf: Buffer): Buffer {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new ImageRejected("corrupt", "Not a JPEG file");
  const parts: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new ImageRejected("corrupt", "Damaged JPEG structure");
    let marker = buf[i + 1];
    while (marker === 0xff && i + 2 < buf.length) {
      i++; // fill bytes before a marker
      marker = buf[i + 1];
    }
    if (marker === undefined) throw new ImageRejected("corrupt", "Damaged JPEG structure");

    if (marker === 0xda) {
      // Start of scan. Everything up to the end-of-image marker is picture data. Inside it every 0xFF is followed
      // by 0x00 (stuffing) or a restart marker, so the first FF D9 is the real end.
      const end = buf.indexOf(Buffer.from([0xff, 0xd9]), i + 2);
      if (end < 0) throw new ImageRejected("corrupt", "JPEG is truncated");
      parts.push(buf.subarray(i, end + 2));
      return Buffer.concat(parts);
    }
    if (marker === 0xd9) {
      parts.push(buf.subarray(i, i + 2));
      return Buffer.concat(parts);
    }
    // Standalone markers have no length: TEM (01) and restart markers (D0-D7).
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > buf.length) throw new ImageRejected("corrupt", "JPEG is truncated");
    const length = buf.readUInt16BE(i + 2);
    const end = i + 2 + length;
    if (length < 2 || end > buf.length) throw new ImageRejected("corrupt", "Damaged JPEG segment");
    const segment = buf.subarray(i, end);

    let keep = true;
    if (marker === 0xe1 || marker === 0xfe) keep = false; // EXIF / XMP, comments
    else if (marker === 0xe2) keep = segment.subarray(4, 4 + ICC_ID.length).equals(ICC_ID); // keep ICC, drop MPF
    else if (marker >= 0xe3 && marker <= 0xed) keep = false;
    else if (marker === 0xef) keep = false;
    // E0 (JFIF) and EE (Adobe) are kept, as are all real coding tables (DQT, DHT, SOF, DRI...).
    if (keep) parts.push(segment);
    i = end;
  }
  throw new ImageRejected("corrupt", "JPEG has no image data");
}

// ---------------------------------------------------------------------------
// WebP: lossless metadata removal
// ---------------------------------------------------------------------------

/** Drops the EXIF and XMP chunks of a WebP file and clears their flags. The picture data is not touched. */
export function stripWebpMetadata(buf: Buffer): Buffer {
  if (sniffImageType(buf) !== "webp") throw new ImageRejected("corrupt", "Not a WebP file");
  const chunks: Buffer[] = [];
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const fourcc = buf.subarray(pos, pos + 4).toString("latin1");
    const size = buf.readUInt32LE(pos + 4);
    const padded = size + (size % 2);
    const end = pos + 8 + padded;
    if (end > buf.length + (size % 2)) throw new ImageRejected("corrupt", "Damaged WebP chunk");
    let chunk = buf.subarray(pos, Math.min(end, buf.length));
    if (fourcc === "EXIF" || fourcc === "XMP ") {
      pos = end;
      continue;
    }
    if (fourcc === "VP8X") {
      chunk = Buffer.from(chunk);
      chunk[8] = chunk[8] & ~0x08 & ~0x04; // clear the EXIF and XMP flags
    }
    chunks.push(chunk);
    pos = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(4 + body.length, 4);
  header.write("WEBP", 8, "latin1");
  return Buffer.concat([header, body]);
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

function open(buf: Buffer) {
  return sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const kind = sniffImageType(input);
  if (!kind) throw new ImageRejected("unsupported_type", "Only JPEG, PNG and WebP images are accepted");

  let meta: Metadata;
  try {
    meta = await open(input).metadata();
  } catch (err) {
    const message = String((err as Error).message);
    if (/pixel limit/i.test(message)) throw new ImageRejected("too_many_pixels", "The image has too many pixels");
    throw new ImageRejected("corrupt", "The image could not be read");
  }
  if ((meta.pages ?? 1) > 1) throw new ImageRejected("animated", "Animated images are not accepted");
  if (!meta.width || !meta.height) throw new ImageRejected("corrupt", "The image could not be read");
  if (meta.width < 16 || meta.height < 16) throw new ImageRejected("too_small", "The image is too small");
  if (meta.width * meta.height > MAX_INPUT_PIXELS) throw new ImageRejected("too_many_pixels", "The image has too many pixels");

  const rotated = (meta.orientation ?? 1) >= 5; // 5 to 8 swap width and height
  const upright = { width: rotated ? meta.height : meta.width, height: rotated ? meta.width : meta.height };

  let master: StoredFile;
  let method: string;

  try {
    if (kind === "jpeg") {
      const needsRotation = (meta.orientation ?? 1) !== 1;
      if (needsRotation || meta.space === "cmyk") {
        const buffer = await open(input)
          .rotate()
          .toColourspace("srgb")
          .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: "4:4:4" })
          .toBuffer();
        master = { buffer, contentType: "image/jpeg", ext: "jpg" };
        method = needsRotation ? "jpeg-rotated-q95" : "jpeg-cmyk-to-srgb-q95";
      } else {
        // Picture data kept byte for byte, so decoding gives exactly the same pixels.
        master = { buffer: stripJpegMetadata(input), contentType: "image/jpeg", ext: "jpg" };
        method = "jpeg-lossless-strip";
      }
    } else if (kind === "webp") {
      master = { buffer: stripWebpMetadata(input), contentType: "image/webp", ext: "webp" };
      method = "webp-lossless-strip";
    } else if (meta.depth === "ushort") {
      // 16-bit PNG: keep as is rather than reduce the bit depth.
      master = { buffer: input, contentType: "image/png", ext: "png" };
      method = "png-16bit-kept";
    } else {
      const tryWebp = meta.width * meta.height <= LOSSLESS_WEBP_MAX_PIXELS;
      const [png, webp] = await Promise.all([
        open(input).png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true, palette: false }).toBuffer(),
        tryWebp ? open(input).webp({ lossless: true, effort: 4, exact: true }).toBuffer() : Promise.resolve(null),
      ]);
      const candidates = [
        { buffer: input, contentType: "image/png", ext: "png" as const, method: "png-original-kept" },
        { buffer: png, contentType: "image/png", ext: "png" as const, method: "png-lossless" },
      ];
      if (webp) candidates.push({ buffer: webp, contentType: "image/webp", ext: "webp" as never, method: "png-to-lossless-webp" });
      const best = candidates.reduce((a, b) => (b.buffer.length < a.buffer.length ? b : a));
      master = { buffer: best.buffer, contentType: best.contentType, ext: best.ext };
      method = best.method;
    }
  } catch (err) {
    if (err instanceof ImageRejected) throw err;
    throw new ImageRejected("corrupt", "The image could not be processed");
  }

  // Thumbnail for cards and grids. Not made when the image is already small.
  let thumb: ProcessedImage["thumb"] = null;
  if (Math.max(upright.width, upright.height) > THUMB_MAX_SIDE) {
    try {
      const { data, info } = await open(input)
        .rotate()
        .resize({ width: THUMB_MAX_SIDE, height: THUMB_MAX_SIDE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY, effort: 6 })
        .toBuffer({ resolveWithObject: true });
      if (data.length < master.buffer.length) {
        thumb = { buffer: data, contentType: "image/webp", ext: "webp", width: info.width, height: info.height };
      }
    } catch {
      throw new ImageRejected("corrupt", "The image could not be processed");
    }
  }

  return {
    master: { ...master, width: upright.width, height: upright.height },
    thumb,
    stats: { originalBytes: input.length, storedBytes: master.buffer.length, thumbBytes: thumb?.buffer.length ?? 0, method },
  };
}
