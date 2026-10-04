import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { reviewDocument } from "@/server/modules/applications/institution.service";

/** PATCH { decision: "approve" } | { decision: "reject", reason } */
export const PATCH = handler<{ id: string; documentId: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, params, user }) =>
  ok({ data: await reviewDocument(user, params.id, params.documentId, await readJson(req)) })
);
