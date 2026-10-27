import { handler } from "@/server/http/handler";
import { noContent, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { deleteRule, getRule, updateRule } from "@/server/modules/admission/rules.service";

const STAFF = ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] as const;

/** One rule with every version, newest first. */
export const GET = handler<{ id: string }>({ auth: STAFF }, async ({ params, user }) => ok({ data: await getRule(user, params.id) }));

/** PATCH { name?, description?, status? }. To change what the rule requires, add a version. */
export const PATCH = handler<{ id: string }>({ auth: STAFF }, async ({ req, params, user }) => ok({ data: await updateRule(user, params.id, await readJson(req)) }));

/** Only while no deliberation has used it. */
export const DELETE = handler<{ id: string }>({ auth: STAFF }, async ({ params, user }) => {
  await deleteRule(user, params.id);
  return noContent();
});
