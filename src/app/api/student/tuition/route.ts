import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { listMine } from "@/server/modules/tuition/tuition.service";

/** The student's tuition accounts (one per offer taken up), with the ways the institution accepts tuition. */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => ok({ data: await listMine(user) }));
