import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { publicRoute, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

// Compared against when the email is unknown, so response time doesn't reveal which emails have accounts.
const dummyHash = hashPassword("not-a-real-password");

export const POST = publicRoute(async (request) => {
  const { email, password } = await readJson(request, loginSchema);
  const user = await db().user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
  }

  const { token, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return response;
});
