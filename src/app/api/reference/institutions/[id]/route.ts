import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getOpenInstitution } from "@/server/modules/institutions/discovery.service";

/**
 * One institution accepting applications, in full: how to reach it, its
 * faculties, departments and programs (with the qualification each leads
 * to and the spaces available), the documents it asks applicants for,
 * and its fee. Only active records are included.
 */
export const GET = handler<{ id: string }>({ auth: "authenticated" }, async ({ params }) => ok({ data: await getOpenInstitution(params.id) }));
