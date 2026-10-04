import { handler } from "@/server/http/handler";
import { noContent, ok } from "@/server/http/respond";
import { getMyApplication, removeInstitution } from "@/server/modules/applications/student.service";

/** One institution application, with choices, documents, payments, history and the submission checklist. */
export const GET = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ params, user }) => ok({ data: await getMyApplication(user, params.id) }));

/** Withdraw an institution before submission. */
export const DELETE = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ params, user }) => {
  await removeInstitution(user, params.id);
  return noContent();
});
