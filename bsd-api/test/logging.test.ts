import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { Writable } from "node:stream";
import { redactedRequest } from "../src/common/logging.js";

describe("request logging keeps search activity private", () => {
  it("drops the query string but keeps the path", () => {
    expect(redactedRequest({ method: "GET", url: "/businesses/search?q=halal+meat&zone=zone-1", ip: "203.0.113.5" })).toEqual({
      method: "GET",
      url: "/businesses/search",
      remoteAddress: "203.0.113.5",
    });
    expect(redactedRequest({ method: "GET", url: "/zones/zone-2" }).url).toBe("/zones/zone-2");
    expect(redactedRequest({ method: "GET" }).url).toBe("");
  });

  it("nothing a visitor searched for reaches the log stream", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const app = Fastify({ logger: { stream, serializers: { req: redactedRequest } } });
    app.get("/businesses/search", async () => ({ ok: true }));
    await app.inject({ method: "GET", url: "/businesses/search?q=secret-search-words&category=legal-and-financial" });
    await app.close();
    const log = lines.join("");
    expect(log).toContain("/businesses/search");
    expect(log).not.toContain("secret-search-words");
    expect(log).not.toContain("legal-and-financial");
  });
});
