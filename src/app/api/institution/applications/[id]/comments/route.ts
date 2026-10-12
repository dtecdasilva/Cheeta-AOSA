import { handler } from "@/server/http/handler";
import { created } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { addComment } from "@/server/modules/applications/institution.service";

/** POST { body, visibleToApplicant? }: adds a comment. The application, with every comment, is returned. */
export const POST = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, params, user }) =>
  created({ data: await addComment(user, params.id, await readJson(req)) })
);
