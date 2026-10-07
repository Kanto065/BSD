import { describe, it, expect, afterEach } from "vitest";
import { makePassToken, verifyPassToken, passTokenCardId, deviceHashOf, passSecretConfigured, slotAt, type PassCardKey } from "../src/common/pass-token.js";

const card: PassCardKey = { id: "ckabcdefghij1234567890", secret: "c2VjcmV0LW9uZQ==", deviceHash: "hash-a" };
const T0 = 1_800_000_010_000; // 10 seconds into a 30 second slot
const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("pass token", () => {
  it("verifies in the same slot and the previous slot, not two slots later (replay window)", () => {
    const t = makePassToken(card, T0)!;
    expect(verifyPassToken(t, card, T0)).toBe(true);
    expect(verifyPassToken(t, card, T0 + 30_000)).toBe(true);
    expect(verifyPassToken(t, card, T0 + 60_000)).toBe(false);
  });

  it("does not accept a token from a later slot (a fast phone clock a full slot ahead is refused)", () => {
    expect(verifyPassToken(makePassToken(card, T0 + 30_000)!, card, T0)).toBe(false);
  });

  it("tolerates a phone clock up to one slot behind the server", () => {
    expect(verifyPassToken(makePassToken(card, T0 - 25_000)!, card, T0)).toBe(true);
  });

  it("fails when tampered, truncated, malformed or made for another card, secret or device", () => {
    const t = makePassToken(card, T0)!;
    const [a, b, c] = t.split(".");
    expect(verifyPassToken(`${a}.${b}.${c!.slice(0, -2)}AA`, card, T0)).toBe(false);
    expect(verifyPassToken(`${a}.${Number(b) + 1}.${c}`, card, T0 + 30_000)).toBe(false);
    for (const bad of ["", "x", "a.b", "a.b.c.d", `${a}.${b}.`, `${a}.-1.${c}`, "x".repeat(300)]) expect(verifyPassToken(bad, card, T0)).toBe(false);
    expect(verifyPassToken(t, { ...card, id: "ckzzzzzzzzzz1234567890" }, T0)).toBe(false);
    expect(verifyPassToken(t, { ...card, secret: "other" }, T0)).toBe(false);
    expect(verifyPassToken(t, { ...card, deviceHash: "hash-b" }, T0)).toBe(false);
    expect(verifyPassToken(t, { ...card, deviceHash: null }, T0)).toBe(false);
  });

  it("holds only the card id, no personal data, and maps back to the card", () => {
    const t = makePassToken(card, T0)!;
    expect(passTokenCardId(t)).toBe(card.id);
    expect(passTokenCardId("junk")).toBeNull();
  });

  it("changes with the server secret", () => {
    process.env.PASS_TOKEN_SECRET = "a".repeat(40);
    const t = makePassToken(card, T0)!;
    process.env.PASS_TOKEN_SECRET = "b".repeat(40);
    expect(verifyPassToken(t, card, T0)).toBe(false);
  });

  it("is switched off in production without a long enough secret", () => {
    process.env.NODE_ENV = "production";
    delete process.env.PASS_TOKEN_SECRET;
    expect(passSecretConfigured()).toBe(false);
    expect(makePassToken(card, T0)).toBeNull();
    process.env.PASS_TOKEN_SECRET = "short";
    expect(passSecretConfigured()).toBe(false);
    process.env.PASS_TOKEN_SECRET = "s".repeat(32);
    expect(makePassToken(card, T0)).not.toBeNull();
  });

  it("reads the interval from PASS_QR_SECONDS and ignores bad values", () => {
    process.env.PASS_QR_SECONDS = "60";
    expect(slotAt(T0)).toBe(Math.floor(T0 / 60_000));
    process.env.PASS_QR_SECONDS = "abc";
    expect(slotAt(T0)).toBe(Math.floor(T0 / 30_000));
    process.env.PASS_QR_SECONDS = "1";
    expect(slotAt(T0)).toBe(Math.floor(T0 / 30_000));
  });

  it("hashes the device with the card id and never keeps the raw id", () => {
    const h = deviceHashOf("device-1234567890abcdef", "card1");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(deviceHashOf("device-1234567890abcdef", "card2")).not.toBe(h);
  });
});
