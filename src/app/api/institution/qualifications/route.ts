import { z } from "zod";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { parseBody } from "@/server/http/validate";
import { getQualifications, institutionOf, setQualifications } from "@/server/modules/institutions/qualifications.service";

/** The institution's Anticipated Qualifications: GET for its staff, PUT (the whole list) for its administrator. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await getQualifications(institutionOf(user)) }));

export const PUT = handler({ auth: ["INSTITUTION_ADMIN"] }, async ({ req, user }) => ok({ data: await setQualifications(user, institutionOf(user), await parseBody(req, z.unknown())) }));
