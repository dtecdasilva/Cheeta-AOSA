import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { decideSubscription } from "@/server/modules/deliberation/deliberation.service";

/** POST { decision: "approve" | "reject", note? }: confirm the annual fee was paid, or turn the request down. */
export const POST = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params, user }) => ok({ data: await decideSubscription(user, params.id, await readJson(req)) }));
