import { beforeEach, describe, expect, it } from "vitest";
import { GET as listDocuments, POST as createDocument } from "@/app/api/documents/route";
import { DELETE as deleteDocument, GET as getDocument, PATCH as updateDocument } from "@/app/api/documents/[id]/route";
import { db } from "@/lib/db";
import { doc, json, makeRequest, paragraph, params, resetDatabase, signIn, text } from "./helpers/api";

beforeEach(resetDatabase);

const richContent = doc(
  { type: "heading", attrs: { level: 2 }, content: [text("Plan")] },
  paragraph(text("Bold", "bold"), text(" and "), text("underlined italic", "italic", "underline")),
  {
    type: "orderedList",
    attrs: { start: 1, type: null },
    content: [{ type: "listItem", content: [paragraph(text("First step"))] }],
  },
);

async function createAs(session: string, title = "Plan") {
  const response = await createDocument(makeRequest("POST", "/api/documents", { session, body: { title } }), undefined);
  expect(response.status).toBe(201);
  return (await json(response)).document;
}

describe("documents", () => {
  it("creates a document, saves rich text, and reopens it with structure intact", async () => {
    const alex = await signIn("alex@papertrail.dev");
    const created = await createAs(alex);
    expect(created).toMatchObject({ title: "Plan", version: 1, role: "OWNER" });

    const saved = await updateDocument(
      makeRequest("PATCH", `/api/documents/${created.id}`, { session: alex, body: { baseVersion: 1, title: "Q3 plan", content: richContent } }),
      params({ id: created.id }),
    );
    expect(saved.status).toBe(200);
    expect((await json(saved)).document.version).toBe(2);

    const reopened = await json(await getDocument(makeRequest("GET", `/api/documents/${created.id}`, { session: alex }), params({ id: created.id })));
    expect(reopened.document.title).toBe("Q3 plan");
    expect(reopened.document.content).toEqual(richContent);
    expect(reopened.document.excerpt).toBe("Plan Bold and underlined italic First step");
    expect(reopened.document.updatedByName).toBe("Alex Morgan");
  });

  it("rejects a save based on a stale version instead of overwriting newer work", async () => {
    const alex = await signIn("alex@papertrail.dev");
    const jordan = await signIn("jordan@papertrail.dev");
    const save = (session: string, baseVersion: number, value: string) =>
      updateDocument(
        makeRequest("PATCH", "/api/documents/welcome", { session, body: { baseVersion, content: doc(paragraph(text(value))) } }),
        params({ id: "welcome" }),
      );

    expect((await save(jordan, 1, "Jordan's edit")).status).toBe(200);
    const stale = await save(alex, 1, "Alex's edit");
    expect(stale.status).toBe(409);
    const conflict = await json(stale);
    expect(conflict.error.message).toMatch(/Jordan Lee saved a newer version/);
    expect(conflict.error.details.document.version).toBe(2);
    expect(conflict.error.details.document.content).toEqual(doc(paragraph(text("Jordan's edit"))));
  });

  it("validates input and content against the editor schema", async () => {
    const alex = await signIn("alex@papertrail.dev");
    const patch = (body: unknown) =>
      updateDocument(makeRequest("PATCH", "/api/documents/welcome", { session: alex, body }), params({ id: "welcome" }));

    const cases: [unknown, number, RegExp][] = [
      [{ baseVersion: 1, title: "   " }, 400, /can't be empty/],
      [{ baseVersion: 1, title: "x".repeat(121) }, 400, /120 characters/],
      [{ title: "No version" }, 400, /expected number/i],
      [{ baseVersion: 1 }, 400, /title or content/],
      [{ baseVersion: 1, content: doc({ type: "image", attrs: { src: "x" } }) }, 400, /isn't valid/],
      [{ baseVersion: 1, content: doc(paragraph(text("x", "link"))) }, 400, /isn't valid/],
      [{ baseVersion: 1, content: "<p>html</p>" }, 400, /isn't valid|must be a document/],
      [{ baseVersion: 1, content: doc({ type: "heading", attrs: { level: 99 }, content: [text("H")] }) }, 400, /isn't valid/],
      [{ baseVersion: 1, content: doc({ type: "orderedList", attrs: { start: "1; x" }, content: [{ type: "listItem", content: [paragraph(text("x"))] }] }) }, 400, /isn't valid/],
      ["not json", 400, /valid JSON/],
    ];
    for (const [body, status, message] of cases) {
      const response = await patch(body);
      expect(response.status, JSON.stringify(body)).toBe(status);
      expect((await json(response)).error.message).toMatch(message);
    }
  });

  it("lets only the owner delete, and deleting removes shares too", async () => {
    const jordan = await signIn("jordan@papertrail.dev");
    const alex = await signIn("alex@papertrail.dev");
    expect((await deleteDocument(makeRequest("DELETE", "/api/documents/welcome", { session: jordan }), params({ id: "welcome" }))).status).toBe(403);
    expect((await deleteDocument(makeRequest("DELETE", "/api/documents/welcome", { session: alex }), params({ id: "welcome" }))).status).toBe(204);
    expect(await db().documentShare.count({ where: { documentId: "welcome" } })).toBe(0);
    expect((await getDocument(makeRequest("GET", "/api/documents/welcome", { session: alex }), params({ id: "welcome" }))).status).toBe(404);
  });

  it("lists owned and shared documents with the caller's role", async () => {
    const alex = await signIn("alex@papertrail.dev");
    const { documents } = await json(await listDocuments(makeRequest("GET", "/api/documents", { session: alex }), undefined));
    const roles = Object.fromEntries(documents.map((item: { id: string; role: string }) => [item.id, item.role]));
    expect(roles).toEqual({ welcome: "OWNER", "design-review": "VIEWER" });
  });
});
