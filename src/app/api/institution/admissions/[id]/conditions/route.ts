import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { ValidationError } from "@/server/http/errors";
import { confirmConditions, withdrawProvisional } from "@/server/modules/deliberation/provisional.service";
import { getForInstitution } from "@/server/modules/deliberation/admissions.service";

const STAFF = ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] as const;

/**
 * Decides a provisional admission's conditions:
 *   { decision: "met", note? }        the admission becomes full (a full letter is issued next time it is opened)
 *   { decision: "not_met", note }     the offer is withdrawn
 */
export const POST = handler<{ id: string }>({ auth: [...STAFF] }, async ({ req, params, user }) => {
  const body = (await readJson(req)) as { decision?: unknown } | null;
  if (body?.decision === "met") await confirmConditions(user, params.id, body);
  else if (body?.decision === "not_met") await withdrawProvisional(user, params.id, body);
  else throw new ValidationError({ decision: "Say whether the conditions were met." });
  return ok({ data: await getForInstitution(user, params.id) });
});
