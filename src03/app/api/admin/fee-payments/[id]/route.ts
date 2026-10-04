import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { reviewFeePayment } from "@/server/modules/applications/admin.service";

/** PATCH { decision: "approve", note? } | { decision: "reject", note } */
export const PATCH = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params, user }) => ok({ data: await reviewFeePayment(user, params.id, await readJson(req)) }));
