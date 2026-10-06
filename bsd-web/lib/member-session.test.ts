import { describe, it, expect } from "vitest";
import { sessionView } from "./member-session";

describe("sessionView", () => {
  it("is out without a member", () => {
    expect(sessionView(null, "card")).toBe("out");
    expect(sessionView(null, "market")).toBe("out");
  });

  it("asks to join when the site is missing", () => {
    expect(sessionView({ modules: ["DIRECTORY"] }, "card")).toBe("join");
    expect(sessionView({ modules: ["CARD"] }, "market")).toBe("join");
    expect(sessionView({ modules: [] }, "card")).toBe("join");
  });

  it("is in once the site is joined", () => {
    expect(sessionView({ modules: ["DIRECTORY", "CARD"] }, "card")).toBe("in");
    expect(sessionView({ modules: ["MARKETPLACE"] }, "market")).toBe("in");
  });
});
