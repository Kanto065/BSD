import { afterEach, describe, expect, it, vi } from "vitest";

const config = (hidden: string[]) => ({ sections: Object.fromEntries(hidden.map((k) => [k, { visible: false, title: null, body: null }])) });

async function load(responder: () => Promise<Response>) {
  vi.resetModules();
  const fetchMock = vi.fn(responder);
  vi.stubGlobal("fetch", fetchMock);
  const mod = await import("./hidden-gate");
  return { ...mod, fetchMock };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("hidden page gate", () => {
  it("stops a hidden hideable page and nothing else", async () => {
    const { isHiddenRequest } = await load(async () => Response.json(config(["about", "faq"])));
    expect(await isHiddenRequest("/about")).toBe(true);
    expect(await isHiddenRequest("/about/")).toBe(true);
    expect(await isHiddenRequest("/faq")).toBe(true);
    expect(await isHiddenRequest("/contact")).toBe(false);
    expect(await isHiddenRequest("/")).toBe(false);
    expect(await isHiddenRequest("/privacy")).toBe(false);
  });

  it("only asks the API for hideable paths, and at most once per 30 seconds", async () => {
    vi.useFakeTimers();
    const { isHiddenRequest, fetchMock } = await load(async () => Response.json(config(["about"])));
    await isHiddenRequest("/search");
    expect(fetchMock).not.toHaveBeenCalled();
    await isHiddenRequest("/about");
    await isHiddenRequest("/faq");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(31_000);
    await isHiddenRequest("/about");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows every page when the API cannot be reached, and keeps the last good list when it fails later", async () => {
    const down = await load(async () => {
      throw new Error("down");
    });
    expect(await down.isHiddenRequest("/about")).toBe(false);

    vi.useFakeTimers();
    let fail = false;
    const m = await load(async () => (fail ? new Response("x", { status: 500 }) : Response.json(config(["about"]))));
    expect(await m.isHiddenRequest("/about")).toBe(true);
    fail = true;
    vi.advanceTimersByTime(31_000);
    expect(await m.isHiddenRequest("/about")).toBe(true);
  });
});
