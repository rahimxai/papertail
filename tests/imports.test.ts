import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as importRoute } from "@/app/api/imports/route";
import { GET as getDocument } from "@/app/api/documents/[id]/route";
import { db } from "@/lib/db";
import { json, makeRequest, params, resetDatabase, signIn } from "./helpers/api";
import { buildDocx } from "./helpers/docx";

beforeEach(resetDatabase);

async function upload(session: string, name: string, data: Uint8Array | string, type = "") {
  const formData = new FormData();
  formData.append("file", new File([data as BlobPart], name, { type }));
  return importRoute(makeRequest("POST", "/api/imports", { session, formData }), undefined);
}

async function reopen(session: string, id: string) {
  return (await json(await getDocument(makeRequest("GET", `/api/documents/${id}`, { session }), params({ id })))).document;
}

describe("file import", () => {
  it("imports Markdown with headings, lists, and inline formatting, and the document reopens", async () => {
    const alex = await signIn("alex@papertrail.dev");
    const markdown = "# Launch plan\n\nShip **bold** and *italic* and <u>underline</u>.\n\n- First\n- Second\n\n1. Step\n\n![chart](chart.png)\n\n<script>alert(1)</script>";
    const response = await upload(alex, "Launch plan.md", markdown, "text/markdown");
    expect(response.status).toBe(201);
    const result = await json(response);
    expect(result.imagesSkipped).toBe(1);

    const document = await reopen(alex, result.document.id);
    expect(document.title).toBe("Launch plan");
    const types = document.content.content.map((node: { type: string }) => node.type);
    expect(types).toEqual(["heading", "paragraph", "bulletList", "orderedList"]);
    const marks = document.content.content[1].content.flatMap((node: { marks?: { type: string }[] }) => node.marks?.map((mark) => mark.type) ?? []);
    expect(marks).toEqual(["bold", "italic", "underline"]);
    expect(JSON.stringify(document.content)).not.toContain("alert");
  });

  it("imports .docx with headings, lists, and formatting", async () => {
    const alex = await signIn("alex@papertrail.dev");
    const docx = await buildDocx([
      { style: "Title", runs: [{ text: "Brief" }] },
      { runs: [{ text: "Plain " }, { text: "bold", bold: true }, { text: " & " }, { text: "under", underline: true }] },
      { style: "Heading2", runs: [{ text: "Goals" }] },
      { list: "bullet", runs: [{ text: "Ship it", italic: true }] },
    ]);
    const response = await upload(alex, "Brief.docx", docx);
    expect(response.status).toBe(201);
    const document = await reopen(alex, (await json(response)).document.id);
    expect(document.content).toMatchObject({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 } },
        { type: "paragraph" },
        { type: "heading", attrs: { level: 2 } },
        { type: "bulletList" },
      ],
    });
    expect(document.excerpt).toBe("Brief Plain bold & under Goals Ship it");
  });

  it("imports plain text line by line and records the source file's metadata", async () => {
    const jordan = await signIn("jordan@papertrail.dev");
    const response = await upload(jordan, "ideas.txt", readFileSync("samples/ideas.txt"), "text/plain");
    expect(response.status).toBe(201);
    const { document } = await json(response);
    expect(document.role).toBe("OWNER");
    const record = await db().fileImport.findFirstOrThrow({ where: { documentId: document.id } });
    expect(record).toMatchObject({ fileName: "ideas.txt", mimeType: "text/plain", sizeBytes: readFileSync("samples/ideas.txt").byteLength });
  });

  it("rejects unsupported, legacy, empty, oversized, corrupt, and non-UTF-8 files with clear messages", async () => {
    const alex = await signIn("alex@papertrail.dev");
    const cases: [string, Uint8Array | string, number, RegExp][] = [
      ["report.pdf", "%PDF-1.4", 415, /Unsupported file type/],
      ["legacy.doc", "x", 400, /Save the file as \.docx/],
      ["empty.md", "", 400, /empty/],
      ["big.txt", new Uint8Array(4 * 1024 * 1024 + 1).fill(97), 413, /4 MB/],
      ["renamed.docx", "just text", 400, /isn't a valid \.docx/],
      ["corrupt.docx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), 400, /Couldn't read this \.docx/],
      ["latin1.txt", new Uint8Array([0x63, 0x61, 0x66, 0xe9]), 400, /isn't UTF-8/],
    ];
    for (const [name, data, status, message] of cases) {
      const response = await upload(alex, name, data);
      expect(response.status, name).toBe(status);
      expect((await json(response)).error.message).toMatch(message);
    }
    expect(await db().document.count({ where: { owner: { email: "alex@papertrail.dev" } } })).toBe(1);
  });

  it("rejects a .docx that is small on the wire but expands to huge XML, before converting it", async () => {
    const alex = await signIn("alex@papertrail.dev");
    // ~12 MB of WordprocessingML that deflates to a few hundred KB: well under the 4 MB upload limit.
    const bomb = await buildDocx(Array.from({ length: 140_000 }, () => ({ runs: [{ text: "a".repeat(60) }] })), { deflate: true });
    expect(bomb.byteLength).toBeLessThan(1024 * 1024);
    const response = await upload(alex, "bomb.docx", bomb);
    expect(response.status).toBe(413);
    expect((await json(response)).error.message).toMatch(/expands to too much content/);
  });
});
