import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { checkRateLimit, rateLimitHeaders } from "@/lib/api/rate-limit";
import {
  DEFAULT_SESSION_TTL_MS,
  SESSION_COOKIE_NAME,
  createSessionToken,
} from "@/lib/auth/session";

function passwordsMatch(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  // Length must match before timingSafeEqual will accept the buffers;
  // comparing against a fixed-length hash of `a` first would remove even
  // that leak, but a shared personal-app password isn't worth the extra
  // complexity here.
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkRateLimit(`auth-login:${ip}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const secret = process.env.AUTH_SECRET;
  const appPassword = process.env.APP_PASSWORD;
  if (!secret || !appPassword) {
    return NextResponse.json(
      { error: "Login is not configured on this deployment" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";

  if (!passwordsMatch(password, appPassword)) {
    return NextResponse.json(
      { error: "Incorrect password" },
      { status: 401, headers: rateLimitHeaders(limit) },
    );
  }

  const token = createSessionToken(secret);
  const res = NextResponse.json({ ok: true }, { headers: rateLimitHeaders(limit) });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DEFAULT_SESSION_TTL_MS / 1000),
  });
  return res;
}
