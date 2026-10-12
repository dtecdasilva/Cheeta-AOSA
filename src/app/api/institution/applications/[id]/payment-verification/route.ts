import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { verifyPayment } from "@/server/modules/applications/institution.service";

/** POST { decision: "verify", note? } | { decision: "not_received", note }: whether the application fee reached the institution's account. */
export const POST = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, params, user }) =>
  ok({ data: await verifyPayment(user, params.id, await readJson(req)) })
);
