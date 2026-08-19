import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "stocklens_session";
export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Not per-user auth — just proof "this browser entered the correct shared
 * password." payload is the expiry timestamp; signature is an HMAC over it
 * so the expiry can't be forged/extended without AUTH_SECRET. */
function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  secret: string,
  ttlMs: number = DEFAULT_SESSION_TTL_MS,
): string {
  const payload = String(Date.now() + ttlMs);
  return `${payload}.${sign(secret, payload)}`;
}

export function verifySessionToken(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts as [string, string];

  const expected = sign(secret, payload);
  const signatureBuf = Buffer.from(signature, "base64url");
  const expectedBuf = Buffer.from(expected, "base64url");
  if (signatureBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(signatureBuf, expectedBuf)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}
