import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { fileResponse } from "@/server/http/fileResponse";
import { NotFoundError } from "@/server/http/errors";
import { isDocType } from "@/lib/documents/types";
import { documentPdf } from "@/server/documents/documents.service";

/**
 * The document as a PDF, generated now from the database (the admission
 * letter: the stored letter as issued). Shown in the browser; ?download=1
 * saves it. Access is checked on every request.
 */
export const GET = handler<{ id: string; type: string }>({ auth: "authenticated" }, async ({ req, params, user }) => {
  if (!isDocType(params.type)) throw new NotFoundError("Document");
  const download = req.nextUrl.searchParams.get("download") === "1";
  const out = await documentPdf(user, params.id, params.type);
  if ("file" in out) return fileResponse(out.file.file, out.file.stream, { download });
  return new NextResponse(Buffer.from(out.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(out.bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(out.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
