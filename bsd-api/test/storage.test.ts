import { describe, it, expect, vi } from "vitest";
import { MemoryStorage, storageFromEnv } from "../src/common/storage.js";

describe("MemoryStorage private area", () => {
  it("keeps private objects out of the public area and reads them back only as private", async () => {
    const s = new MemoryStorage();
    await s.put({ key: "students/u/a.png", body: Buffer.from("x"), contentType: "image/png", private: true });
    expect(s.objects.size).toBe(0);
    expect(await s.get("students/u/a.png")).toBeNull();
    expect((await s.get("students/u/a.png", { private: true }))?.contentType).toBe("image/png");
    await s.delete("students/u/a.png", { private: true });
    expect(await s.get("students/u/a.png", { private: true })).toBeNull();
  });
});

describe("S3 storage key prefix", () => {
  it("writes private objects under private/ with no-store, and public ones under public/", async () => {
    const s = storageFromEnv({ S3_ENDPOINT: "http://localhost:1", S3_BUCKET: "b", S3_ACCESS_KEY: "k", S3_SECRET_KEY: "s" } as NodeJS.ProcessEnv)!;
    const sent: { input: Record<string, unknown> }[] = [];
    vi.spyOn((s as unknown as { client: { send: unknown } }).client as { send: (c: unknown) => Promise<unknown> }, "send").mockImplementation(async (cmd: unknown) => {
      sent.push(cmd as { input: Record<string, unknown> });
      return { Body: { transformToByteArray: async () => new Uint8Array([1]) }, ContentType: "image/png" };
    });
    await s.put({ key: "k1", body: Buffer.from("x"), contentType: "image/png", private: true });
    await s.put({ key: "k2", body: Buffer.from("x"), contentType: "image/png" });
    await s.get("k1", { private: true });
    await s.delete("k1", { private: true });
    expect(sent.map((c) => c.input.Key)).toEqual(["private/k1", "public/k2", "private/k1", "private/k1"]);
    expect(sent[0]!.input.CacheControl).toBe("no-store");
    expect(String(sent[1]!.input.CacheControl)).toMatch(/public/);
  });
});
