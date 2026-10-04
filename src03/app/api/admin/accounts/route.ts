import { handler } from "@/server/http/handler";
import { created, paged } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { listResource } from "@/server/modules/resource";
import { accountResource, inviteAccount } from "@/server/modules/accounts/accounts.service";

/** GET: platform accounts (?role=, ?institutionId=, ?q=, ?status=). POST: invite a staff account; a temporary code is emailed. */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => {
  const r = await listResource(accountResource, req, {});
  return paged(r.data, r.meta);
});
export const POST = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => created(await inviteAccount(await readJson(req))));
