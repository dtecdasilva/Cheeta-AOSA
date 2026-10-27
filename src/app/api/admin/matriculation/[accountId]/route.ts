import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { confirmMatriculation, getRow } from "@/server/modules/matriculation/matriculation.service";

/**
 * GET: where the student stands. POST { note? }: confirm matriculation and
 * issue the code. Only the institution's administrator or Cheeta
 * administration, and only once admission, tuition and medical
 * verification are complete.
 */
export const GET = handler<{ accountId: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params, user }) => ok({ data: await getRow(user, params.accountId) }));
export const POST = handler<{ accountId: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params, user }) => ok({ data: await confirmMatriculation(user, params.accountId, await readJson(req).catch(() => ({}))) }));
