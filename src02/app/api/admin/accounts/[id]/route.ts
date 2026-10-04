import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { getResource } from "@/server/modules/resource";
import { accountResource, updateAccount } from "@/server/modules/accounts/accounts.service";

export const GET = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params }) => ok({ data: await getResource(accountResource, params.id, {}) }));
export const PATCH = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params, user }) => ok({ data: await updateAccount(params.id, await readJson(req), user.id) }));
