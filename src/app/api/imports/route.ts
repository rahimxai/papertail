import { NextResponse } from "next/server";
import { badRequest, tooLarge } from "@/lib/errors";
import { authedRoute } from "@/lib/http";
import { importFile, MAX_IMPORT_BYTES } from "@/server/imports";

export const POST = authedRoute(async (request, _context, user) => {
  // Reject oversized uploads before buffering the body.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_IMPORT_BYTES + 64 * 1024) {
    throw tooLarge("Files are limited to 4 MB.");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Upload the file as multipart form data in a field named “file”.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Choose a file to import.");

  const result = await importFile(user, {
    name: file.name,
    type: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  return NextResponse.json(result, { status: 201 });
});
