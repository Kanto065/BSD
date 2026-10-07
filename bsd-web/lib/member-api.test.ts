import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteAccount } from "./member-api";
import { ApiError } from "./admin-session";

afterEach(() => vi.unstubAllGlobals());

describe("deleteAccount", () => {
  it("sends DELETE /auth/me with the password and the session cookie", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteAccount("https://api.example", "Correct-Horse-Battery-77")).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example/auth/me");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({ password: "Correct-Horse-Battery-77" });
  });

  it("throws the API's field error for a wrong password", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Please check the highlighted fields.", fieldErrors: { password: "That password is not correct." } }, { status: 400 })));
    const err = await deleteAccount("https://api.example", "nope").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.fieldErrors.password).toBe("That password is not correct.");
  });
});
