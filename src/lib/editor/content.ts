import "server-only";
import { getSchema, type JSONContent } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { badRequest, tooLarge } from "@/lib/errors";
import { editorExtensions, MAX_DOCUMENT_CHARACTERS } from "./extensions";

const schema = getSchema(editorExtensions);
const MAX_CONTENT_JSON_BYTES = 2 * 1024 * 1024;
const EXCERPT_LENGTH = 160;

export type ValidatedContent = { json: JSONContent; excerpt: string };

/**
 * Parses untrusted editor JSON against the editor schema. Unknown node or mark types, invalid nesting,
 * and malformed shapes are rejected, so only content the editor itself can produce is ever stored.
 */
export function validateDocumentContent(input: unknown): ValidatedContent {
  if (JSON.stringify(input ?? null).length > MAX_CONTENT_JSON_BYTES) {
    throw tooLarge("This document is too large to save.");
  }
  let node: ProseMirrorNode;
  try {
    node = ProseMirrorNode.fromJSON(schema, input);
    node.check();
  } catch {
    throw badRequest("Document content isn't valid for this editor.");
  }
  if (node.type.name !== "doc") {
    throw badRequest("Document content must be a document.");
  }
  // The schema checks structure, not attribute values; reject values the editor itself can never produce.
  node.descendants((child) => {
    if (child.type.name === "heading" && ![1, 2, 3].includes(child.attrs.level)) {
      throw badRequest("Document content isn't valid for this editor.");
    }
    if (child.type.name === "orderedList" && !(Number.isInteger(child.attrs.start) && child.attrs.start >= 0)) {
      throw badRequest("Document content isn't valid for this editor.");
    }
  });
  const text = node.textBetween(0, node.content.size, "\n", " ");
  if (text.length > MAX_DOCUMENT_CHARACTERS) {
    throw tooLarge(`Documents are limited to ${MAX_DOCUMENT_CHARACTERS.toLocaleString("en-US")} characters.`);
  }
  return { json: node.toJSON() as JSONContent, excerpt: makeExcerpt(text) };
}

function makeExcerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : flat;
}
