import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { documentsFor } from "@/server/documents/documents.service";

/** One application's documents, and which can be opened now. */
export const GET = handler<{ id: string }>({ auth: "authenticated" }, async ({ params, user }) => ok({ data: await documentsFor(user, params.id) }));
