import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { listForInstitution } from "@/server/modules/tuition/tuition.service";

/** The institution's admitted students' tuition, as it may see it: masked until Cheeta verifies a payment. */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await listForInstitution(user) }));
