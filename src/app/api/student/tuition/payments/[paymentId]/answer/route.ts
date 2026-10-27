import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { answerQuery } from "@/server/modules/tuition/tuition.service";

/** POST { note }: the student's answer to a query; the payment goes back for checking. */
export const POST = handler<{ paymentId: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => ok({ data: await answerQuery(user, params.paymentId, await readJson(req)) }));
