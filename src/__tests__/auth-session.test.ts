import { describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

const SECRET = "test-secret-value";

describe("session token", () => {
  it("round-trips a freshly created token", () => {
    const token = createSessionToken(SECRET);
    expect(verifySessionToken(token, SECRET)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const token = createSessionToken(SECRET);
    const [payload] = token.split(".");
    const tampered = `${payload}.not-the-real-signature-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
    expect(verifySessionToken(tampered, SECRET)).toBe(false);
  });

  it("rejects a tampered payload (extended expiry)", () => {
    const token = createSessionToken(SECRET);
    const [, signature] = token.split(".");
    const farFuture = `${Date.now() + 999_999_999_999}.${signature}`;
    expect(verifySessionToken(farFuture, SECRET)).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(SECRET, -1);
    expect(verifySessionToken(token, SECRET)).toBe(false);
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = createSessionToken(SECRET);
    expect(verifySessionToken(token, "a-different-secret")).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("not-a-valid-token", SECRET)).toBe(false);
    expect(verifySessionToken("", SECRET)).toBe(false);
    expect(verifySessionToken("a.b.c", SECRET)).toBe(false);
  });
});
