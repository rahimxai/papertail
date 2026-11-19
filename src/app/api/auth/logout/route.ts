import { NextResponse } from "next/server";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth/session";
import { publicRoute } from "@/lib/http";

export const POST = publicRoute(async (request) => {
  await deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
});
