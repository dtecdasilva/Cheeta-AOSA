import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { ForbiddenError } from "@/server/http/errors";
import { getDb } from "@/server/db/client";
import { documentTypeOptions, platformMaxUploadKb } from "@/server/modules/institutions/institutions.resources";

/**
 * The document types the caller's institution can ask applicants for,
 * each with the file formats and largest size the platform allows for it,
 * and whether the institution already asks for it.
 */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return ok({ data: await documentTypeOptions(getDb(), user.institutionId), maxUploadKb: platformMaxUploadKb() });
});
