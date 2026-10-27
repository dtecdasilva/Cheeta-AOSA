import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { updateRecord } from "@/server/modules/medical/medical.service";

/** PATCH { status, result?, verificationDate?, centre?, certificateRef?, note? }: Cheeta administration or the institution's administrator only. */
export const PATCH = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params, user }) => ok({ data: await updateRecord(user, params.id, await readJson(req)) }));
