import { DeleteObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Where uploaded images are kept. Production uses a bucket on the MinIO server that is shared with another project on
// the same VPS (bucket "bsd-uploads", with a BSD-only access key that can reach nothing else). Objects are written
// under the "public/" prefix, which anonymous users may read but never list. bsd.wales serves them at /uploads/...
// through the Caddy site file (deploy/bsd.caddy), so image URLs are same-origin paths like /uploads/businesses/x.webp.

export type PutInput = { key: string; body: Buffer; contentType: string };

export interface ObjectStorage {
  readonly kind: "s3" | "memory";
  put(input: PutInput): Promise<void>;
  delete(key: string): Promise<void>;
  /** Throws if the storage cannot be reached. Used by the readiness check. */
  check(): Promise<void>;
}

/** The site-relative URL a stored key is served at. */
export function publicUrl(key: string): string {
  return `/uploads/${key}`;
}

const PREFIX = "public/";

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

  async put({ key, body, contentType }: PutInput) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: PREFIX + key,
        Body: body,
        ContentType: contentType,
        // Keys are random and never reused, so a stored image never changes.
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: PREFIX + key }));
  }

  async check() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}

/** Keeps objects in memory. Used by tests, and in local development when no bucket is configured. */
export class MemoryStorage implements ObjectStorage {
  readonly kind = "memory" as const;
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  failPuts = false;

  async put({ key, body, contentType }: PutInput) {
    if (this.failPuts) throw new Error("storage unavailable");
    this.objects.set(key, { body, contentType });
  }

  async delete(key: string) {
    this.objects.delete(key);
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
