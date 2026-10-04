import { handler } from "@/server/http/handler";
import { created } from "@/server/http/respond";
import { BadRequestError } from "@/server/http/errors";
import { uploadDocument } from "@/server/modules/applications/student.service";

/** multipart/form-data { requirementId, file }: upload a required document. Replaces an earlier upload for the same requirement. */
export const POST = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => {
  const form = await req.formData().catch(() => {
    throw new BadRequestError("Send the file as multipart/form-data.");
  });
  return created({ data: await uploadDocument(user, params.id, form) });
});
