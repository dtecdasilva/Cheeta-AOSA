import { handler } from "@/server/http/handler";
import { created } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { recordFeePayment } from "@/server/modules/applications/student.service";

/** POST { method, reference, paidAt, receiptFileId? }: record an application fee paid outside the platform. The amount is computed server-side. */
export const POST = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => created({ data: await recordFeePayment(user, params.id, await readJson(req)) }));
