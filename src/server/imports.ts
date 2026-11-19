import "server-only";
import type { JSONContent } from "@tiptap/core";
import { generateJSON } from "@tiptap/html/server";
import mammoth from "mammoth";
import { Marked } from "marked";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError, badRequest, tooLarge } from "@/lib/errors";
import { editorExtensions } from "@/lib/editor/extensions";
import { validateDocumentContent } from "@/lib/editor/content";
import type { SessionUser } from "@/lib/auth/session";
import { getDocument, type DocumentDetail } from "./documents";

// Vercel Functions reject request bodies over 4.5 MB before our code runs, so stay safely below that
// (multipart encoding adds overhead) to give users our error message instead of a platform error.
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const SUPPORTED_IMPORT_TYPES = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
} as const;
type SupportedExtension = keyof typeof SUPPORTED_IMPORT_TYPES;

const MAMMOTH_OPTIONS = {
  styleMap: ["u => u", "p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"],
};

// Raw HTML inside Markdown is dropped except the two tags the editor can represent. This is defense in depth:
// the result is also parsed against the editor schema, which discards anything it doesn't know.
const SAFE_INLINE_HTML = /^<\/?(u|br)\s*\/?>$/i;
const markdown = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      return SAFE_INLINE_HTML.test(text.trim()) ? text : "";
    },
  },
});

export type ConvertedFile = { title: string; content: JSONContent; imagesSkipped: number };

// A .docx is a zip, and XML compresses ~300:1, so a small upload can expand to gigabytes inside mammoth.
// The 100k-character document limit only applies after conversion, so bound the expanded size up front.
// 10 MB of WordprocessingML is far more than 100k characters of heavily formatted text needs.
const MAX_DOCX_XML_PART_BYTES = 10 * 1024 * 1024;
const MAX_DOCX_TOTAL_BYTES = 40 * 1024 * 1024;

/**
 * Reads uncompressed entry sizes from the zip central directory without inflating anything.
 * Returns null if the archive structure can't be found, leaving malformed files to mammoth's error path.
 */
function zipEntrySizes(bytes: Uint8Array): { name: string; size: number }[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minEocd = 22;
  let eocd = -1;
  for (let i = bytes.length - minEocd; i >= Math.max(0, bytes.length - minEocd - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: { name: string; size: number }[] = [];
  for (let n = 0; n < count; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) return null;
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    // 0xFFFFFFFF means the real size is in a ZIP64 extra field: by definition far beyond our limits.
    entries.push({ name, size: size === 0xffffffff ? Number.POSITIVE_INFINITY : size });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function assertDocxExpandsSafely(bytes: Uint8Array) {
  const entries = zipEntrySizes(bytes);
  if (!entries) return;
  const total = entries.reduce((sum, entry) => sum + entry.size, 0);
  const oversizedXml = entries.some((entry) => entry.name.endsWith(".xml") && entry.size > MAX_DOCX_XML_PART_BYTES);
  if (oversizedXml || total > MAX_DOCX_TOTAL_BYTES) {
    throw tooLarge("This .docx expands to too much content to import. Split it into smaller documents and try again.");
  }
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot).toLowerCase() : "";
}

function decodeUtf8(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw badRequest("This file isn't UTF-8 text. Re-save it as UTF-8 and try again.");
  }
  if (text.includes("\u0000")) throw badRequest("This file doesn't look like a text file.");
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function plainTextToJson(text: string): JSONContent {
  const lines = text.replace(/\n+$/, "").split("\n");
  return {
    type: "doc",
    content: lines.map((line) => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" })),
  };
}

const countImages = (html: string) => (html.match(/<img\b/gi) ?? []).length;

// Images aren't supported, so a paragraph that held only an image would become an empty line; drop those.
const dropImageOnlyParagraphs = (html: string) => html.replace(/<p>(?:\s|<img\b[^>]*>)*<\/p>/gi, "");

/** Converts an uploaded file into editor content. Every path ends in the editor schema's validation. */
export async function convertFile(fileName: string, bytes: Uint8Array): Promise<ConvertedFile> {
  const extension = extensionOf(fileName);
  if (extension === ".doc") {
    throw badRequest("Legacy .doc files aren't supported. Save the file as .docx and try again.");
  }
  if (!(extension in SUPPORTED_IMPORT_TYPES)) {
    throw new AppError(415, "UNSUPPORTED_TYPE", "Unsupported file type. Upload a .docx, .md, or .txt file.");
  }
  if (bytes.byteLength === 0) throw badRequest("This file is empty.");
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw tooLarge("Files are limited to 4 MB.");

  let json: JSONContent;
  let imagesSkipped = 0;
  switch (extension as SupportedExtension) {
    case ".txt":
      json = plainTextToJson(decodeUtf8(bytes));
      break;
    case ".md":
    case ".markdown": {
      const html = markdown.parse(decodeUtf8(bytes), { async: false });
      imagesSkipped = countImages(html);
      json = generateJSON(dropImageOnlyParagraphs(html), editorExtensions) as JSONContent;
      break;
    }
    case ".docx": {
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
      if (!isZip) throw badRequest("This file isn't a valid .docx document.");
      assertDocxExpandsSafely(bytes);
      let html: string;
      try {
        ({ value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) }, MAMMOTH_OPTIONS));
      } catch {
        throw badRequest("Couldn't read this .docx file. It may be corrupted or password-protected.");
      }
      imagesSkipped = countImages(html);
      json = generateJSON(dropImageOnlyParagraphs(html), editorExtensions) as JSONContent;
      break;
    }
  }

  const title = fileName.slice(0, fileName.length - extension.length).trim().slice(0, 120) || "Imported document";
  return { title, content: validateDocumentContent(json).json, imagesSkipped };
}

/** Creates a new document from an uploaded file and records where it came from. */
export async function importFile(
  user: SessionUser,
  file: { name: string; type: string; bytes: Uint8Array },
): Promise<{ document: DocumentDetail; imagesSkipped: number }> {
  const converted = await convertFile(file.name, file.bytes);
  const { json, excerpt } = validateDocumentContent(converted.content);
  const extension = extensionOf(file.name) as SupportedExtension;

  const documentId = await db().$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title: converted.title,
        content: json as Prisma.InputJsonValue,
        excerpt,
        ownerId: user.id,
        updatedById: user.id,
      },
      select: { id: true },
    });
    await tx.fileImport.create({
      data: {
        documentId: document.id,
        importedById: user.id,
        fileName: file.name.slice(0, 255),
        mimeType: (file.type || SUPPORTED_IMPORT_TYPES[extension]).slice(0, 255),
        sizeBytes: file.bytes.byteLength,
      },
    });
    return document.id;
  });

  return { document: await getDocument(documentId, user), imagesSkipped: converted.imagesSkipped };
}
