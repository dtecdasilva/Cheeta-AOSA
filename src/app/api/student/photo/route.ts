import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { BadRequestError } from "@/server/http/errors";
import { myPhoto, removePhoto, setPhoto } from "@/server/modules/student/photo.service";

/** The applicant's photo: GET it, POST a new one (multipart: file), DELETE it. */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ data: await myPhoto(user) }));
export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => {
  const form = await req.formData().catch(() => {
    throw new BadRequestError("Send the file as multipart/form-data.");
  });
  const file = form.get("file");
  return created({ data: await setPhoto(user, file instanceof File ? file : null) });
});
export const DELETE = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ data: await removePhoto(user) }));
