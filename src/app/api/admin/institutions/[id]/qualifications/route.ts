import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getQualifications } from "@/server/modules/institutions/qualifications.service";

/** One institution's Anticipated Qualifications, for Cheeta administration's program screens. */
export const GET = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params }) => ok({ data: await getQualifications(params.id) }));
