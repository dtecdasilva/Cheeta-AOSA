import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createRule, listRules } from "@/server/modules/admission/rules.service";

const STAFF = ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] as const;

/** The institution's admission rules, each with its current version. */
export const GET = handler({ auth: STAFF }, async ({ user }) => ok({ data: await listRules(user) }));

/** POST { name, description?, condition, scope?, notes? }: creates a rule as version 1. */
export const POST = handler({ auth: STAFF }, async ({ req, user }) => created({ data: await createRule(user, await readJson(req)) }));
