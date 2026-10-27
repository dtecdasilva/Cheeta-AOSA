import { handler } from "@/server/http/handler";
import { fileResponse } from "@/server/http/fileResponse";
import { noContent } from "@/server/http/respond";
import { deleteFile, openFileFor } from "@/server/storage/files.service";

/**
 * Opens a file. Only for a signed-in account that may read it, checked
 * now, against what the file is attached to: an applicant gets their own
 * documents, receipts and admission letters, an institution the documents
 * of applications made to it and the letters it issued, Cheeta
 * administration any. Anything else is "not found". ?download=1 saves it.
 */
export const GET = handler<{ id: string }>({ auth: "authenticated" }, async ({ req, params, user }) => {
  const { file, stream } = await openFileFor(user, params.id);
  return fileResponse(file, stream, { download: req.nextUrl.searchParams.get("download") === "1" });
});

export const DELETE = handler<{ id: string }>({ auth: "authenticated" }, async ({ params, user }) => {
  await deleteFile(user, params.id);
  return noContent();
});
