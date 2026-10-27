import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { BadRequestError } from "@/server/http/errors";
import { addMedia, listMine } from "@/server/modules/student/disability.service";

/**
 * GET: the applicant's disability photos and video.
 * POST multipart/form-data { file, caption? }: adds one (JPG/PNG photo, up to 3; or one MP4/MOV/WebM video).
 * Only while the answer to the disability question is Yes.
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ data: await listMine(user) }));
export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => {
  const form = await req.formData().catch(() => {
    throw new BadRequestError("Send the file as multipart/form-data.");
  });
  const file = form.get("file");
  return created({ data: await addMedia(user, file instanceof File ? file : null, String(form.get("caption") ?? "")) });
});
