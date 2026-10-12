import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { listOpenInstitutions } from "@/server/modules/institutions/discovery.service";

/**
 * Institutions accepting applications, for browsing on Add Institution.
 * Each comes with its type, location, how many programs it offers and
 * spaces it has, how many programs an applicant may rank there, and what
 * applying costs today in the base currency.
 */
export const GET = handler({ auth: "authenticated" }, async () => ok({ data: await listOpenInstitutions() }));
