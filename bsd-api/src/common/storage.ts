import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Where uploaded images are kept. Production uses a bucket on the MinIO server that is shared with another project on
// the same VPS (bucket "bsd-uploads", with a BSD-only access key that can reach nothing else). Objects are written
// under the "public/" prefix, which anonymous users may read but never list. bsd.wales serves them at /uploads/...
// through the Caddy site file (deploy/bsd.caddy), so image URLs are same-origin paths like /uploads/businesses/x.webp.
//
// Student proof documents go under the "private/" prefix instead. It has no public URL, is never cached, and is read
// back only through get(), by the admin API.

// private: true stores under "private/" (student proofs).
export type PutInput = { key: string; body: Buffer; contentType: string; private?: boolean };
export type PrivateOpt = { private?: boolean };

export interface ObjectStorage {
  readonly kind: "s3" | "memory";
  put(input: PutInput): Promise<void>;
  delete(key: string, opts?: PrivateOpt): Promise<void>;
  /** Reads an object back. Null when it does not exist. */
  get(key: string, opts?: PrivateOpt): Promise<{ body: Buffer; contentType: string } | null>;
  /** Throws if the storage cannot be reached. Used by the readiness check. */
  check(): Promise<void>;
}

/** The site-relative URL a stored key is served at. Only for public keys, private objects never have one. */
export function publicUrl(key: string): string {
  return `/uploads/${key}`;
}

const PREFIX = "public/";
export const PRIVATE_PREFIX = "private/";
const prefixOf = (o?: PrivateOpt) => (o?.private ? PRIVATE_PREFIX : PREFIX);

class S3Storage implements ObjectStorage {
  readonly kind = "s3" as const;
  private client: S3Client;

  constructor(
    endpoint: string,
    private bucket: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ) {
    // MinIO needs path-style addressing (http://minio:9000/bucket/key).
    this.client = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
  }

  async put({ key, body, contentType, private: isPrivate }: PutInput) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: prefixOf({ private: isPrivate }) + key,
        Body: body,
        ContentType: contentType,
        // Public keys are random and never reused, so a stored image never changes. Private files are never cached.
        CacheControl: isPrivate ? "no-store" : "public, max-age=31536000, immutable",
      })
    );
  }

  async delete(key: string, opts?: PrivateOpt) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: prefixOf(opts) + key }));
  }

  async get(key: string, opts?: PrivateOpt) {
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: prefixOf(opts) + key }));
      if (!out.Body) return null;
      return { body: Buffer.from(await out.Body.transformToByteArray()), contentType: out.ContentType ?? "application/octet-stream" };
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  async check() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}

/** Keeps objects in memory. Used by tests, and in local development when no bucket is configured. */
export class MemoryStorage implements ObjectStorage {
  readonly kind = "memory" as const;
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  /** Private objects are kept apart, so a test can prove a proof never lands in the public area. */
  readonly privateObjects = new Map<string, { body: Buffer; contentType: string }>();
  failPuts = false;
  failDeletes = false;

  private area(o?: PrivateOpt) {
    return o?.private ? this.privateObjects : this.objects;
  }

  async put({ key, body, contentType, private: isPrivate }: PutInput) {
    if (this.failPuts) throw new Error("storage unavailable");
    this.area({ private: isPrivate }).set(key, { body, contentType });
  }

  async delete(key: string, opts?: PrivateOpt) {
    if (this.failDeletes) throw new Error("storage unavailable");
    this.area(opts).delete(key);
  }

  async get(key: string, opts?: PrivateOpt) {
    return this.area(opts).get(key) ?? null;
  }

  async check() {
    if (this.failPuts) throw new Error("storage unavailable");
  }
}

/**
 * Storage from the environment: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY and optional S3_REGION.
 * Returns null in production when it is not configured, so uploads are refused instead of silently disappearing.
 */
export function storageFromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStorage | null {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION } = env;
  if (S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY) {
    return new S3Storage(S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION || "us-east-1");
  }
  return env.NODE_ENV === "production" ? null : new MemoryStorage();
}

