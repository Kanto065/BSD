import { describe, expect, it } from "vitest";
import { passwordProblem } from "../src/common/passwords.js";

describe("passwordProblem", () => {
  it("needs at least 8 characters", () => {
    expect(passwordProblem("Xk4$m9Q", "a@b.co")).toBe("Use at least 8 characters.");
    expect(passwordProblem("Xk4$m9Qz", "a@b.co")).toBeNull();
  });
});
