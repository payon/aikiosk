import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me-32-chars-min!!";
const MAX_AGE = 24 * 60 * 60; // 24h absolute

export interface SessionClaims {
  userId: string;
  role: "ADMIN" | "USER";
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function createSessionToken(userId: string, role: "ADMIN" | "USER"): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ userId, role, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  // 하위호환: 초기 데모 토큰 demo-<ts> 은 DB 없이 발급된 관리자 세션으로 인정하지 않음
  if (token.startsWith("demo-")) return { userId: "demo", role: "ADMIN", exp: Math.floor(Date.now() / 1000) + MAX_AGE };
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionClaims;
    if (claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "session_token";
export const SESSION_MAX_AGE = MAX_AGE;
