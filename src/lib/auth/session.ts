import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "papertrail_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: string; email: string; name: string };

// Only the hash is stored, so a leaked sessions table can't be replayed as cookies.
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db().session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

/** Resolves a cookie token to its user. Identity always comes from here, never from client-supplied ids. */
export async function getUserForSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db().session.findUnique({
    where: { id: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, email: true, name: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await db().session.deleteMany({ where: { id: hashToken(token) } });
    return null;
  }
  return session.user;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (token) await db().session.deleteMany({ where: { id: hashToken(token) } });
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}
