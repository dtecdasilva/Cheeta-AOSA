import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { registrableInstitutionTypes } from "@/server/modules/institutions/institutionTypes";

/** GET: the institution types offered on the registration form (public: the form is used before signing in). */
export const GET = handler({ auth: "public" }, async () => ok({ data: await registrableInstitutionTypes() }));
