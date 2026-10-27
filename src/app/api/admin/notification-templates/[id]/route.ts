import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { getTemplate, updateTemplate } from "@/server/modules/notifications/templates.service";

export const GET = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params }) => ok({ data: await getTemplate(params.id) }));
/** Name, wording, notes or status. New wording makes a new version; activating with replaceActive: true swaps out the active one. */
export const PATCH = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params, user }) => ok({ data: await updateTemplate(user, params.id, await readJson(req)) }));
