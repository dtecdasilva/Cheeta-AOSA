import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { NotFoundError } from "@/server/http/errors";
import { isDocType } from "@/lib/documents/types";
import { documentModel } from "@/server/documents/documents.service";

/** The document's content from the database, as the screen shows it. The PDF is at ./pdf. */
export const GET = handler<{ id: string; type: string }>({ auth: "authenticated" }, async ({ params, user }) => {
  if (!isDocType(params.type)) throw new NotFoundError("Document");
  return ok({ data: await documentModel(user, params.id, params.type) });
});
