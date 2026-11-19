import { beforeEach, describe, expect, it } from "vitest";
import { GET as listDocuments } from "@/app/api/documents/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { db } from "@/lib/db";
import { json, makeRequest, resetDatabase, signIn } from "./helpers/api";

beforeEach(resetDatabase);

describe("authentication", () => {
  it("signs in with demo credentials and sets an HttpOnly, SameSite session cookie", async () => {
    const response = await login(
      makeRequest("POST", "/api/auth/login", { body: { email: "Alex@Papertrail.dev ", password: "papertrail-demo" } }),
      undefined,
    );
    expect(response.status).toBe(200);
    expect((await json(response)).user.name).toBe("Alex Morgan");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/papertrail_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it("rejects a wrong password and an unknown email with the same message", async () => {
    const wrong = await login(makeRequest("POST", "/api/auth/login", { body: { email: "alex@papertrail.dev", password: "nope" } }), undefined);
    const unknown = await login(makeRequest("POST", "/api/auth/login", { body: { email: "who@papertrail.dev", password: "nope" } }), undefined);
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await json(wrong)).error.message).toBe((await json(unknown)).error.message);
  });

  it("identifies users only by server session, never by client-supplied ids", async () => {
    const alex = await db().user.findUniqueOrThrow({ where: { email: "alex@papertrail.dev" } });
    const noSession = await listDocuments(makeRequest("GET", "/api/documents", { headers: { "x-user-id": alex.id } }), undefined);
    expect(noSession.status).toBe(401);
    const forged = await listDocuments(makeRequest("GET", "/api/documents", { session: "forged-token" }), undefined);
    expect(forged.status).toBe(401);
  });

  it("invalidates the session on sign-out and when it expires", async () => {
    const token = await signIn("alex@papertrail.dev");
    expect((await listDocuments(makeRequest("GET", "/api/documents", { session: token }), undefined)).status).toBe(200);

    await logout(makeRequest("POST", "/api/auth/logout", { session: token }), undefined);
    expect((await listDocuments(makeRequest("GET", "/api/documents", { session: token }), undefined)).status).toBe(401);

    const second = await signIn("alex@papertrail.dev");
    await db().session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await listDocuments(makeRequest("GET", "/api/documents", { session: second }), undefined)).status).toBe(401);
  });

  it("stores only a hash of the session token", async () => {
    const token = await signIn("jordan@papertrail.dev");
    const sessions = await db().session.findMany({ select: { id: true } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).not.toBe(token);
    expect(sessions[0]!.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("blocks cross-site mutations by Origin", async () => {
    const response = await login(
      makeRequest("POST", "/api/auth/login", {
        body: { email: "alex@papertrail.dev", password: "papertrail-demo" },
        headers: { origin: "https://evil.example", host: "localhost:3000" },
      }),
      undefined,
    );
    expect(response.status).toBe(403);
  });
});
