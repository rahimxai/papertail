import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, badRequest, forbidden, tooLarge, unauthorized } from "@/lib/errors";
import { getUserForSessionToken, SESSION_COOKIE, type SessionUser } from "@/lib/auth/session";

const MAX_JSON_BYTES = 3 * 1024 * 1024;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type ErrorBody = { error: { code: string; message: string; details?: unknown } };

export function errorResponse(error: unknown): NextResponse<ErrorBody> {
  // Next.js uses thrown errors for control flow (e.g. "this route is dynamic" during build); never swallow them.
  unstable_rethrow(error);
  if (error instanceof AppError) {
    const body: ErrorBody = { error: { code: error.code, message: error.message } };
    if (error.details !== undefined) body.error.details = error.details;
    return NextResponse.json(body, { status: error.status });
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message } }, { status: 400 });
  }
  console.error("Unhandled API error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

// Session cookies are SameSite=Lax, which already stops cross-site POSTs; this Origin check is defense in depth.
function assertSameOrigin(request: NextRequest) {
  if (!MUTATING_METHODS.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || new URL(origin).host !== host) {
    throw forbidden("Cross-site requests are not allowed.");
  }
}

export async function readJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_JSON_BYTES) {
    throw tooLarge("Request body is too large.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(body);
}

type Handler<C> = (request: NextRequest, context: C) => Promise<Response>;
type AuthedHandler<C> = (request: NextRequest, context: C, user: SessionUser) => Promise<Response>;

/** Wraps a public route handler with origin checks and consistent JSON errors. */
export function publicRoute<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      assertSameOrigin(request);
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Like publicRoute, but resolves the signed-in user from the session cookie or responds 401. */
export function authedRoute<C>(handler: AuthedHandler<C>): Handler<C> {
  return publicRoute(async (request, context) => {
    const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) throw unauthorized();
    return handler(request, context, user);
  });
}
