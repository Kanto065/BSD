import { describe, expect, it } from "vitest";
import { MAX_PROOF_BYTES, proofProblem, studentView } from "./student-api";

describe("proofProblem", () => {
  it("accepts JPG, PNG, WebP and PDF up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) expect(proofProblem({ type, size: 1000 })).toBeNull();
    expect(proofProblem({ type: "image/png", size: MAX_PROOF_BYTES })).toBeNull();
  });
  it("explains a wrong type, an empty file and a file over 5 MB", () => {
    expect(proofProblem({ type: "text/plain", size: 10 })).toBe("Upload a JPG, PNG, WebP or PDF file.");
    expect(proofProblem({ type: "image/gif", size: 10 })).toBe("Upload a JPG, PNG, WebP or PDF file.");
    expect(proofProblem({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(proofProblem({ type: "image/png", size: MAX_PROOF_BYTES + 1 })).toMatch(/5 MB/);
  });
});

describe("studentView", () => {
  it("maps the API status to the block that shows", () => {
    expect(studentView({ status: "NONE", verified: false })).toBe("none");
    expect(studentView({ status: "PENDING", verified: false })).toBe("pending");
    expect(studentView({ status: "REJECTED", verified: false })).toBe("rejected");
    expect(studentView({ status: "EXPIRED", verified: false })).toBe("expired");
    expect(studentView({ status: "VERIFIED", verified: true })).toBe("verified");
  });
  it("shows verified whenever the badge exists", () => {
    expect(studentView({ status: "EXPIRED", verified: true })).toBe("verified");
  });
});
