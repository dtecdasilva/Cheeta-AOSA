import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { reviewTuitionPayment } from "@/server/modules/tuition/tuition.service";

/** POST { action: "verify" | "query" | "reject" | "reopen", note?, reasonId? }. Only verified payments count towards the tuition. */
export const POST = handler<{ paymentId: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params, user }) => ok({ data: await reviewTuitionPayment(user, params.paymentId, await readJson(req)) }));
