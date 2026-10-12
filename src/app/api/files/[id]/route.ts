import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { noContent } from "@/server/http/respond";
import { deleteFile, openFileFor } from "@/server/storage/files.service";

/**
 * Opens a file. Only for a signed-in account that may read it, checked
 * now, against what the file is attached to: an applicant gets their own
 * documents and receipts, an institution the documents of applications
 * made to it, Cheeta administration any. Anything else is "not found".
 */
export const GET = handler<{ id: string }>({ auth: "authenticated" }, async ({ params, user }) => {
  const { file, stream } = await openFileFor(user, params.id);
  const inline = file.mimeType === "application/pdf" || file.mimeType.startsWith("image/");
  return new NextResponse(stream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      // Served as exactly the type its content was checked to be when it was uploaded (PDF, JPEG or PNG), never guessed by the browser.
      "X-Content-Type-Options": "nosniff",
      // Not kept by the browser or anything between: the next request is checked again.
      "Cache-Control": "private, no-store",
    },
  });
});

export const DELETE = handler<{ id: string }>({ auth: "authenticated" }, async ({ params, user }) => {
  await deleteFile(user, params.id);
  return noContent();
});
