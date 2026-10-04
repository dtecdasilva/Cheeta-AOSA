import { handler } from "@/server/http/handler";
import { created } from "@/server/http/respond";
import { BadRequestError, ValidationError } from "@/server/http/errors";
import { isFilePurpose, signedDownloadUrl, storeUpload } from "@/server/storage/files.service";

/**
 * Upload a standalone file (multipart/form-data: file, purpose), e.g. a
 * payment receipt to attach to a fee payment. Application documents are
 * uploaded through their application instead, so they're checked against
 * the institution's requirement.
 */
export const POST = handler({ auth: "authenticated" }, async ({ req, user }) => {
  const form = await req.formData().catch(() => {
    throw new BadRequestError("Send the file as multipart/form-data.");
  });
  const file = form.get("file");
  const purpose = String(form.get("purpose") ?? "");
  if (!(file instanceof File)) throw new ValidationError({ file: "Choose a file to upload." });
  if (!isFilePurpose(purpose) || purpose === "application-document" || purpose === "admission-letter") throw new ValidationError({ purpose: "Unknown upload purpose." });
  const stored = await storeUpload({ owner: user, file, purpose });
  return created({ data: { id: stored.id, name: stored.originalName, size: stored.sizeBytes, mimeType: stored.mimeType, url: await signedDownloadUrl(user, stored) } });
});
