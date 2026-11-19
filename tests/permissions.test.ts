import { beforeEach, describe, expect, it } from "vitest";
import { GET as listDocuments } from "@/app/api/documents/route";
import { GET as getDocument, PATCH as updateDocument } from "@/app/api/documents/[id]/route";
import { GET as listShares, POST as share } from "@/app/api/documents/[id]/shares/route";
import { DELETE as revoke, PATCH as changeRole } from "@/app/api/documents/[id]/shares/[userId]/route";
import { db } from "@/lib/db";
import { doc, json, makeRequest, paragraph, params, resetDatabase, signIn, text } from "./helpers/api";

beforeEach(resetDatabase);

async function edit(session: string, id: string) {
  const current = await db().document.findUniqueOrThrow({ where: { id }, select: { version: true } });
  return updateDocument(
    makeRequest("PATCH", `/api/documents/${id}`, { session, body: { baseVersion: current.version, content: doc(paragraph(text("edit"))) } }),
    params({ id }),
  );
}
const read = (session: string, id: string) => getDocument(makeRequest("GET", `/api/documents/${id}`, { session }), params({ id }));
const grant = (session: string, id: string, email: string, role: string) =>
  share(makeRequest("POST", `/api/documents/${id}/shares`, { session, body: { email, role } }), params({ id }));
const userId = async (email: string) => (await db().user.findUniqueOrThrow({ where: { email } })).id;

describe("access control", () => {
  it("returns not found for documents the user has no access to, even by direct URL", async () => {
    const alex = await signIn("alex@papertrail.dev");
    const response = await read(alex, "research-notes");
    expect(response.status).toBe(404);
    expect(JSON.stringify(await json(response))).not.toContain("Private research");
    expect((await read(alex, "does-not-exist")).status).toBe(404);
    expect((await edit(alex, "research-notes")).status).toBe(404);
  });

  it("lets a viewer read but not edit", async () => {
    const sam = await signIn("sam@papertrail.dev");
    const response = await read(sam, "welcome");
    expect(response.status).toBe(200);
    expect((await json(response)).document.role).toBe("VIEWER");
    const attempt = await edit(sam, "welcome");
    expect(attempt.status).toBe(403);
    expect((await json(attempt)).error.message).toMatch(/view-only/);
  });

  it("lets an editor edit but not manage sharing", async () => {
    const jordan = await signIn("jordan@papertrail.dev");
    expect((await edit(jordan, "welcome")).status).toBe(200);
    expect((await grant(jordan, "welcome", "sam@papertrail.dev", "EDITOR")).status).toBe(403);
    const samId = await userId("sam@papertrail.dev");
    const roleChange = await changeRole(
      makeRequest("PATCH", `/api/documents/welcome/shares/${samId}`, { session: jordan, body: { role: "EDITOR" } }),
      params({ id: "welcome", userId: samId }),
    );
    expect(roleChange.status).toBe(403);
  });

  it("persists sharing changes, which take effect on the very next request", async () => {
    const sam = await signIn("sam@papertrail.dev");
    const jordan = await signIn("jordan@papertrail.dev");
    expect((await read(jordan, "research-notes")).status).toBe(404);

    expect((await grant(sam, "research-notes", "jordan@papertrail.dev", "VIEWER")).status).toBe(201);
    expect((await read(jordan, "research-notes")).status).toBe(200);
    expect((await edit(jordan, "research-notes")).status).toBe(403);

    // Sharing again with the same person changes their role rather than duplicating the share.
    expect((await grant(sam, "research-notes", "jordan@papertrail.dev", "EDITOR")).status).toBe(200);
    expect((await edit(jordan, "research-notes")).status).toBe(200);
    expect(await db().documentShare.count({ where: { documentId: "research-notes" } })).toBe(1);

    const jordanId = await userId("jordan@papertrail.dev");
    const revoked = await revoke(
      makeRequest("DELETE", `/api/documents/research-notes/shares/${jordanId}`, { session: sam }),
      params({ id: "research-notes", userId: jordanId }),
    );
    expect(revoked.status).toBe(204);
    expect((await read(jordan, "research-notes")).status).toBe(404);
    const { documents } = await json(await listDocuments(makeRequest("GET", "/api/documents", { session: jordan }), undefined));
    expect(documents.map((item: { id: string }) => item.id)).not.toContain("research-notes");
  });

  it("validates share requests", async () => {
    const alex = await signIn("alex@papertrail.dev");
    expect((await grant(alex, "welcome", "nobody@papertrail.dev", "VIEWER")).status).toBe(404);
    expect((await grant(alex, "welcome", "alex@papertrail.dev", "VIEWER")).status).toBe(400);
    expect((await grant(alex, "welcome", "jordan@papertrail.dev", "OWNER")).status).toBe(400);
    expect((await grant(alex, "welcome", "not-an-email", "VIEWER")).status).toBe(400);
  });

  it("shows collaborators to everyone with access but only lets the owner manage them", async () => {
    const sam = await signIn("sam@papertrail.dev");
    const people = await json(await listShares(makeRequest("GET", "/api/documents/welcome/shares", { session: sam }), params({ id: "welcome" })));
    expect(people.canManage).toBe(false);
    expect(people.owner.name).toBe("Alex Morgan");
    expect(people.shares.map((person: { name: string; role: string }) => `${person.name}:${person.role}`)).toEqual([
      "Jordan Lee:EDITOR",
      "Sam Rivera:VIEWER",
    ]);
  });
});
