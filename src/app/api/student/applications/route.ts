import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { addInstitution, listMyApplications, listMyApplicationsInFull } from "@/server/modules/applications/student.service";

/**
 * The institutions the applicant has applied to.
 *
 *   GET             the applicant's applications by intake, each with the institutions in it (id, reference, status).
 *   GET ?view=full  one flat list with every institution application in full: program choices, document requirements
 *                   and uploads, payments, and the submission checklist. What the applicant portal's screens load.
 *   POST { institutionId }  apply to an institution in the current intake. Its fee is assessed as it is added.
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ req, user }) =>
  ok({ data: new URL(req.url).searchParams.get("view") === "full" ? await listMyApplicationsInFull(user) : await listMyApplications(user) })
);
export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => created({ data: await addInstitution(user, await readJson(req)) }));
