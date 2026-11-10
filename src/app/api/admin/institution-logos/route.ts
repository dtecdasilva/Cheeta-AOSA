import { handler } from "@/server/http/handler";
import { created } from "@/server/http/respond";
import { BadRequestError, ValidationError } from "@/server/http/errors";
import { fileUrl, storeUpload } from "@/server/storage/files.service";

/**
 * Upload an institution's logo (multipart/form-data: file). Cheeta administration only: the logo is then attached to
 * an institution by saving the institution with `logoFileId` set to the id returned here. Until it is attached, only
 * the administrator who uploaded it can open it (src/server/storage/files.service.ts, `fileAccess`).
 */
export const POST = handler({ auth: ["AOSA_ADMIN"] }, async ({ req, user }) => {
  const form = await req.formData().catch(() => {
    throw new BadRequestError("Send the file as multipart/form-data.");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ValidationError({ file: "Choose an image to upload." });
  const stored = await storeUpload({ owner: user, file, purpose: "institution-logo" });
  return created({ data: { id: stored.id, url: fileUrl(stored) } });
});
