import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { listMine } from "@/server/modules/matriculation/matriculation.service";

/** The student's matriculation, and what it still needs, per offer taken up. */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ data: await listMine(user) }));
