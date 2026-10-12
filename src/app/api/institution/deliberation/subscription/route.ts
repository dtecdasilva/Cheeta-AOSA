import { handler } from "@/server/http/handler";
import { created } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { requestSubscription } from "@/server/modules/deliberation/deliberation.service";

/**
 * POST { paymentReference, note? }: an institution administrator asks to
 * subscribe to deliberation for a year at the current prices. The
 * subscription starts when the Cheeta administrator confirms the payment.
 */
export const POST = handler({ auth: ["INSTITUTION_ADMIN"] }, async ({ req, user }) => created({ data: await requestSubscription(user, await readJson(req)) }));
