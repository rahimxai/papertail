import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { DEMO_PASSWORD, seedDemoData } from "@/server/seed";
import { POST as login } from "@/app/api/auth/login/route";

/** Clears and re-seeds the test database. Refuses to run against anything but TEST_DATABASE_URL. */
export async function resetDatabase() {
  if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Refusing to reset: DATABASE_URL is not the test database.");
  }
  await db().$executeRawUnsafe('TRUNCATE "FileImport", "DocumentShare", "Session", "Document", "User" CASCADE');
  await seedDemoData(db());
}

type RequestOptions = { session?: string; body?: unknown; headers?: Record<string, string>; formData?: FormData };

export function makeRequest(method: string, path: string, options: RequestOptions = {}): NextRequest {
  const headers = new Headers(options.headers);
  if (options.session) headers.set("cookie", `${SESSION_COOKIE}=${options.session}`);
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }
  return new NextRequest(new URL(path, "http://localhost:3000"), { method, headers, body });
}

export const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

// Tests navigate arbitrary API JSON; strict typing here would add noise without catching real bugs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>;
export async function json(response: Response): Promise<Json> {
  return response.status === 204 ? {} : ((await response.json()) as Json);
}

/** Signs in through the real login route and returns the session token from the Set-Cookie header. */
export async function signIn(email: string, password = DEMO_PASSWORD): Promise<string> {
  const response = await login(makeRequest("POST", "/api/auth/login", { body: { email, password } }), undefined);
  if (response.status !== 200) throw new Error(`Sign-in failed for ${email}: ${response.status}`);
  const match = /papertrail_session=([^;]+)/.exec(response.headers.get("set-cookie") ?? "");
  if (!match) throw new Error("No session cookie set");
  return match[1]!;
}

export const doc = (...content: Json[]): Json => ({ type: "doc", content });
export const paragraph = (...content: Json[]): Json => ({ type: "paragraph", content });
export const text = (value: string, ...marks: string[]): Json =>
  marks.length ? { type: "text", text: value, marks: marks.map((type) => ({ type })) } : { type: "text", text: value };
