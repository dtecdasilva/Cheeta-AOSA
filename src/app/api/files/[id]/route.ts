import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { ForbiddenError, UnauthorizedError } from "@/server/http/errors";
import { noContent } from "@/server/http/respond";
import { getDb } from "@/server/db/client";
import { canRead, deleteFile, getFile, openFile, verifyDownloadToken } from "@/server/storage/files.service";

/**
 * Download. Allowed with a valid signed link (?t=..., issued only to
 * someone who may read the file) or a session that may read it.
 */
export const GET = handler<{ id: string }>({ auth: "public" }, async ({ req, params, user }) => {
  const file = await getFile(getDb(), params.id);
  const signed = await verifyDownloadToken(file.id, req.nextUrl.searchParams.get("t"));
  if (!signed) {
    if (!user) throw new UnauthorizedError();
    if (!canRead(user, file)) throw new ForbiddenError();
  }
  const stream = await openFile(file);
  const inline = file.mimeType === "application/pdf" || file.mimeType.startsWith("image/");
  return new NextResponse(stream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
});

export const DELETE = handler<{ id: string }>({ auth: "authenticated" }, async ({ params, user }) => {
  await deleteFile(user, params.id);
  return noContent();
});
