import { handler } from "@/server/http/handler";
import { created } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { recordPayment } from "@/server/modules/tuition/tuition.service";

/** Records a payment already made outside the platform. It counts once Cheeta administration verifies it. */
export const POST = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => created({ data: await recordPayment(user, params.id, await readJson(req)) }));
