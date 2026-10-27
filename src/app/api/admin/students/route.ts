import { handler } from "@/server/http/handler";
import { created, paged } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { listStudentsForAdmin, registerStudentForAdmin } from "@/server/modules/admin/adminData.service";

/** GET: every registered student, paged. POST: register a student on their behalf (their login details are emailed). */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => {
  const r = await listStudentsForAdmin(req);
  return paged(r.data, r.meta);
});
export const POST = handler({ auth: ["AOSA_ADMIN"] }, async ({ req, user }) => created({ data: await registerStudentForAdmin(user, await readJson(req)) }));
