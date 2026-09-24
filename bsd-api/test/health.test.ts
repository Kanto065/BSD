import { describe, it, expect, afterAll, vi } from "vitest";

// The health route never touches the database, so stub Prisma and run without one.
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    async $connect() {}
    async $disconnect() {}
  },
}));

const { buildApp } = await import("../src/server.js");

describe("GET /health", () => {
  const app = buildApp();

  afterAll(async () => {
    await app.close();
  });

  it("returns status ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
