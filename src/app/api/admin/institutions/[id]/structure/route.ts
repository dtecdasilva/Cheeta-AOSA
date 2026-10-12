import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getStructure } from "@/server/modules/institutions/structure.service";

/** GET: one institution's structure: faculty -> department -> qualification -> study program. */
export const GET = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params }) => ok({ data: await getStructure(params.id) }));
