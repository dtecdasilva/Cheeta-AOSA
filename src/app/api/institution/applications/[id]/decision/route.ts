import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { decide } from "@/server/modules/applications/institution.service";

/** POST { action: "acknowledge" } | { action: "reject", reasonId, note? } | { action: "accept", programId, note? } */
export const POST = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, params, user }) => ok({ data: await decide(user, params.id, await readJson(req)) }));
