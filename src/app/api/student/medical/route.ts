import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { listMine } from "@/server/modules/medical/medical.service";

/** The student's medical requirements, their results, and whether they are medically cleared. */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok(await listMine(user)));
