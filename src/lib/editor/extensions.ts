import StarterKit from "@tiptap/starter-kit";
import type { Extensions, JSONContent } from "@tiptap/core";

// The single source of truth for what a document can contain. The browser editor, server-side content
// validation, and file imports all build their schema from this list, so they can never disagree.
export const editorExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    link: false,
    strike: false,
  }),
];

export const EMPTY_DOCUMENT: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export const MAX_DOCUMENT_CHARACTERS = 100_000;
