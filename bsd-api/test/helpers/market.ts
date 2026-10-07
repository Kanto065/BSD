import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { signToken, SESSION_COOKIE } from "../../src/common/tokens.js";

// Shared by the marketplace tests.

export function multipart(fields: Record<string, string>, files: { name: string; type: string; body: Buffer; field?: string }[] = []) {
  const boundary = "----bsdtest" + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  for (const f of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${f.field ?? "images"}"; filename="${f.name}"\r\nContent-Type: ${f.type}\r\n\r\n`));
    chunks.push(f.body, Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

/** A noisy JPEG, big enough that it must be shrunk to fit 300 KB. */
export async function noisyJpeg(width = 2400, height = 1800): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

export async function makeMember(prisma: PrismaClient, label: string, module: "MARKETPLACE" | null = "MARKETPLACE") {
  const u = await prisma.user.create({
    data: {
      name: `Member ${label}`, email: `${label}@test.example`, passwordHash: "x", postcode: "SA1 4PE", postcodeDistrict: "SA1",
      ...(module ? { modules: { create: { module } } } : {}),
    },
  });
  return { id: u.id, cookie: `${SESSION_COOKIE}=${signToken("session", u.id, u.tokenVersion)}` };
}

export const VALID = {
  kind: "SELL", title: "Blue bicycle for sale", description: "A blue bicycle in good shape, ridden twice a week.", price: "45.50",
  category: "buy-and-sell", postcode: "sa1  4pe", whatsapp: "07700 900123", legalAcknowledged: "true",
};

export async function post(app: FastifyInstance, cookie: string | undefined, fields: Record<string, string>, files: Parameters<typeof multipart>[1] = []) {
  const m = multipart(fields, files);
  const res = await app.inject({ method: "POST", url: "/market/listings", payload: m.payload, headers: { ...m.headers, ...(cookie ? { cookie } : {}) } });
  return { status: res.statusCode, text: res.body, body: res.body ? JSON.parse(res.body) : null };
}

export async function call(app: FastifyInstance, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, opts: { cookie?: string; body?: object } = {}) {
  const res = await app.inject({ method, url, headers: opts.cookie ? { cookie: opts.cookie } : {}, ...(opts.body ? { payload: opts.body } : {}) });
  return { status: res.statusCode, text: res.body, body: res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : null };
}
