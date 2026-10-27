import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { markReceived } from "@/server/modules/tuition/tuition.service";

/** POST { received: true | false }: the verified payment is (or isn't) on the institution's own statement. */
export const POST = handler<{ paymentId: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, params, user }) => ok({ data: await markReceived(user, params.paymentId, await readJson(req)) }));
