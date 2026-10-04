import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { removeDocument } from "@/server/modules/applications/student.service";

export const DELETE = handler<{ id: string; documentId: string }>({ auth: ["STUDENT"] }, async ({ params, user }) => ok({ data: await removeDocument(user, params.id, params.documentId) }));
