import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { addInstitution, listMyApplications } from "@/server/modules/applications/student.service";

/** GET: the applicant's applications by intake. POST { institutionId }: apply to an institution in the current intake. */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ data: await listMyApplications(user) }));
export const POST = handler({ auth: ["STUDENT"] }, async ({ req, user }) => created({ data: await addInstitution(user, await readJson(req)) }));
