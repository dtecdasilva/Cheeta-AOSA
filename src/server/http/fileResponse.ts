import { NextResponse } from "next/server";
import type { StoredFile } from "@/server/storage/files.service";

/** A stored file as the response: shown in the browser (PDFs and images) or, with `download`, saved. */
export function fileResponse(file: StoredFile, stream: ReadableStream<Uint8Array>, opts: { download?: boolean } = {}) {
  const inline = !opts.download && (file.mimeType === "application/pdf" || file.mimeType.startsWith("image/"));
  return new NextResponse(stream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      // Served as exactly the type it was stored as, never guessed by the browser.
      "X-Content-Type-Options": "nosniff",
      // Not kept by the browser or anything between: the next request is checked again.
      "Cache-Control": "private, no-store",
    },
  });
}
